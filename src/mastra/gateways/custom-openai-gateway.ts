import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
import { createOpenAI } from '@ai-sdk/openai';

const DEFAULT_GATEWAY_ID = 'custom';
const DEFAULT_GATEWAY_NAME = 'Custom OpenAI-Compatible Gateway';
const DEFAULT_PROVIDER_ID = 'openai';
const DEFAULT_PROVIDER_NAME = 'OpenAI Compatible';
const DEFAULT_BASE_URL = 'https://api.example.com/v1';
const DEFAULT_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_MODELS = ['gpt-5.4'];
const DEFAULT_MODEL_ID = FALLBACK_MODELS[0];

type OpenAICompatibleModelsResponse = {
  data?: Array<{
    id?: string;
    supported_endpoint_types?: string[];
  }>;
};

export const customOpenAIGatewayId = process.env.CUSTOM_OPENAI_GATEWAY_ID || DEFAULT_GATEWAY_ID;
const customOpenAIGatewayName = process.env.CUSTOM_OPENAI_GATEWAY_NAME || DEFAULT_GATEWAY_NAME;
export const customOpenAIProviderId = process.env.CUSTOM_OPENAI_PROVIDER_ID || DEFAULT_PROVIDER_ID;
const customOpenAIProviderName = process.env.CUSTOM_OPENAI_PROVIDER_NAME || DEFAULT_PROVIDER_NAME;
const customOpenAIDefaultModelId = process.env.CUSTOM_OPENAI_DEFAULT_MODEL || DEFAULT_MODEL_ID;
const customOpenAIModelCacheTtlMs = Number.parseInt(
  process.env.CUSTOM_OPENAI_MODEL_CACHE_TTL_MS || '',
  10,
);

export const customOpenAIDefaultModel = `${customOpenAIGatewayId}/${customOpenAIProviderId}/${customOpenAIDefaultModelId}`;

let cachedModels: string[] | null = null;
let cachedModelsAt = 0;
let pendingModelsRequest: Promise<string[]> | null = null;

export class CustomOpenAIGateway extends MastraModelGateway {
  readonly id = customOpenAIGatewayId;
  readonly name = customOpenAIGatewayName;

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const configuredApiKeyEnvVar = process.env.CUSTOM_OPENAI_API_KEY
      ? 'CUSTOM_OPENAI_API_KEY'
      : 'OPENAI_API_KEY';

    return {
      [customOpenAIProviderId]: {
        name: customOpenAIProviderName,
        models: await this.getModels(),
        apiKeyEnvVar: configuredApiKeyEnvVar,
        gateway: this.id,
        url: this.buildUrl(),
      },
    };
  }

  buildUrl(): string {
    return process.env.CUSTOM_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  }

  private getModelCacheTtlMs(): number {
    return Number.isFinite(customOpenAIModelCacheTtlMs) && customOpenAIModelCacheTtlMs > 0
      ? customOpenAIModelCacheTtlMs
      : DEFAULT_MODEL_CACHE_TTL_MS;
  }

  private buildModelsUrl(): string {
    return new URL('models', `${this.buildUrl()}/`).toString();
  }

  private async fetchModelsFromEndpoint(): Promise<string[]> {
    const apiKey = await this.getApiKey();
    const response = await fetch(this.buildModelsUrl(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as OpenAICompatibleModelsResponse;
    const models = (payload.data || [])
      .filter(model => model.id)
      .filter(model => {
        const endpointTypes = model.supported_endpoint_types;
        return !endpointTypes || endpointTypes.length === 0 || endpointTypes.includes('openai');
      })
      .map(model => model.id!.trim())
      .filter(Boolean);

    return Array.from(new Set(models));
  }

  private async getModels(): Promise<string[]> {
    const now = Date.now();
    if (cachedModels && now - cachedModelsAt < this.getModelCacheTtlMs()) {
      return cachedModels;
    }

    if (!pendingModelsRequest) {
      pendingModelsRequest = this.fetchModelsFromEndpoint()
        .then(models => {
          const nextModels = models.length > 0 ? models : FALLBACK_MODELS;
          cachedModels = nextModels;
          cachedModelsAt = Date.now();
          return nextModels;
        })
        .catch(error => {
          if (cachedModels) {
            return cachedModels;
          }

          console.warn(
            `[CustomOpenAIGateway] Falling back to default models after /models fetch failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          cachedModels = FALLBACK_MODELS;
          cachedModelsAt = Date.now();
          return FALLBACK_MODELS;
        })
        .finally(() => {
          pendingModelsRequest = null;
        });
    }

    return pendingModelsRequest;
  }

  async getApiKey(): Promise<string> {
    const apiKey = process.env.CUSTOM_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('CUSTOM_OPENAI_API_KEY or OPENAI_API_KEY must be set');
    }

    return apiKey;
  }

  resolveLanguageModel({
    modelId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }) {
    return createOpenAI({
      apiKey,
      baseURL: this.buildUrl(),
      headers,
    }).chat(modelId);
  }
}

export const customOpenAIGateway = new CustomOpenAIGateway();
