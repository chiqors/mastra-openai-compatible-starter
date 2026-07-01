import { MastraModelGateway, type AttachmentCapabilities, type ProviderConfig } from '@mastra/core/llm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import {
  customOpenAIBaseUrl,
  customOpenAIGatewayId,
  customOpenAIGatewayName,
  customOpenAIModelCacheTtlMs,
  customOpenAIProviderId,
  customOpenAIProviderName,
  FALLBACK_MODELS,
} from './config';
import { normalizeCallOptions } from './normalize-prompt';
import type { OpenAICompatibleModelsResponse } from './types';

export { customOpenAIDefaultModel, customOpenAIGatewayId } from './config';

let cachedModels: string[] | null = null;
let cachedModelsAt = 0;
let pendingModelsRequest: Promise<string[]> | null = null;

export class CustomOpenAIGateway extends MastraModelGateway {
  readonly id = customOpenAIGatewayId;
  readonly name = customOpenAIGatewayName();

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const configuredApiKeyEnvVar = process.env.CUSTOM_OPENAI_API_KEY
      ? 'CUSTOM_OPENAI_API_KEY'
      : 'OPENAI_API_KEY';

    return {
      [customOpenAIProviderId]: {
        name: customOpenAIProviderName(),
        models: await this.getModels(),
        apiKeyEnvVar: configuredApiKeyEnvVar,
        gateway: this.id,
        url: this.buildUrl(),
      },
    };
  }

  getAttachmentCapabilities(): AttachmentCapabilities {
    const models = cachedModels ?? FALLBACK_MODELS;
    return {
      [customOpenAIProviderId]: models,
    };
  }

  buildUrl(): string {
    return customOpenAIBaseUrl();
  }

  private getModelCacheTtlMs(): number {
    return customOpenAIModelCacheTtlMs();
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
    const model = createOpenAICompatible({
      name: customOpenAIProviderId,
      apiKey,
      baseURL: this.buildUrl(),
      headers,
    }).languageModel(modelId);

    return {
      ...model,
      doGenerate: async (options: LanguageModelV4CallOptions) => model.doGenerate(await normalizeCallOptions(options)),
      doStream: async (options: LanguageModelV4CallOptions) => model.doStream(await normalizeCallOptions(options)),
    };
  }
}

export const customOpenAIGateway = new CustomOpenAIGateway();
