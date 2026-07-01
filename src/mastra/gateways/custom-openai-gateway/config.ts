export const DEFAULT_GATEWAY_ID = 'custom';
export const DEFAULT_GATEWAY_NAME = 'Custom OpenAI-Compatible Gateway';
export const DEFAULT_PROVIDER_ID = 'openai';
export const DEFAULT_PROVIDER_NAME = 'OpenAI Compatible';
export const DEFAULT_BASE_URL = 'https://api.example.com/v1';
export const DEFAULT_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_TEXT_ATTACHMENT_MAX_CHARS = 20_000;
export const DEFAULT_TEXT_ATTACHMENT_MAX_BYTES = 256_000;
export const FALLBACK_MODELS = ['gpt-5.4'];
export const DEFAULT_MODEL_ID = FALLBACK_MODELS[0];

export const customOpenAIGatewayId = process.env.CUSTOM_OPENAI_GATEWAY_ID || DEFAULT_GATEWAY_ID;
export const customOpenAIProviderId = process.env.CUSTOM_OPENAI_PROVIDER_ID || DEFAULT_PROVIDER_ID;
export const customOpenAIDefaultModelId = process.env.CUSTOM_OPENAI_DEFAULT_MODEL || DEFAULT_MODEL_ID;

export const customOpenAIDefaultModel = `${customOpenAIGatewayId}/${customOpenAIProviderId}/${customOpenAIDefaultModelId}`;

export function customOpenAIGatewayName(): string {
  return process.env.CUSTOM_OPENAI_GATEWAY_NAME || DEFAULT_GATEWAY_NAME;
}

export function customOpenAIProviderName(): string {
  return process.env.CUSTOM_OPENAI_PROVIDER_NAME || DEFAULT_PROVIDER_NAME;
}

export function customOpenAIBaseUrl(): string {
  return process.env.CUSTOM_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
}

export function customOpenAIModelCacheTtlMs(): number {
  const configured = Number.parseInt(process.env.CUSTOM_OPENAI_MODEL_CACHE_TTL_MS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MODEL_CACHE_TTL_MS;
}

export function textAttachmentMaxChars(): number {
  const configured = Number.parseInt(process.env.CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_ATTACHMENT_MAX_CHARS;
}

export function textAttachmentMaxBytes(): number {
  const configured = Number.parseInt(process.env.CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_ATTACHMENT_MAX_BYTES;
}
