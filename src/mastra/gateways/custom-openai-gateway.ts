import { MastraModelGateway, type AttachmentCapabilities, type ProviderConfig } from '@mastra/core/llm';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4FilePart,
  LanguageModelV4TextPart,
  LanguageModelV4Prompt,
} from '@ai-sdk/provider';

const DEFAULT_GATEWAY_ID = 'custom';
const DEFAULT_GATEWAY_NAME = 'Custom OpenAI-Compatible Gateway';
const DEFAULT_PROVIDER_ID = 'openai';
const DEFAULT_PROVIDER_NAME = 'OpenAI Compatible';
const DEFAULT_BASE_URL = 'https://api.example.com/v1';
const DEFAULT_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TEXT_ATTACHMENT_MAX_CHARS = 20_000;
const DEFAULT_TEXT_ATTACHMENT_MAX_BYTES = 256_000;
const FALLBACK_MODELS = ['gpt-5.4'];
const DEFAULT_MODEL_ID = FALLBACK_MODELS[0];

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  '.py',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.cpp',
  '.cxx',
  '.cc',
  '.c',
  '.h',
  '.hpp',
  '.swift',
  '.kt',
  '.kts',
  '.rb',
  '.php',
  '.scala',
  '.sql',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.yaml',
  '.yml',
  '.json',
  '.toml',
  '.ini',
  '.conf',
  '.cfg',
  '.env',
  '.example',
  '.md',
  '.mdx',
  '.txt',
  '.log',
  '.csv',
]);

const TEXT_ATTACHMENT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/x-json',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
  'application/x-toml',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/sql',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-httpd-php',
  'application/x-env',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'text/log',
  'text/xml',
  'text/html',
  'text/css',
  'text/javascript',
  'text/x-python',
  'text/x-typescript',
  'text/x-tsx',
  'text/x-javascript',
  'text/x-go',
  'text/x-rust',
  'text/x-java-source',
  'text/x-csharp',
  'text/x-shellscript',
  'text/x-toml',
  'text/x-yaml',
]);

type OpenAICompatibleModelsResponse = {
  data?: Array<{
    id?: string;
    supported_endpoint_types?: string[];
  }>;
};

function parseDataUrl(value: string): { mediaType?: string; data: Uint8Array } | null {
  const match = value.match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match) {
    return null;
  }

  const [, mediaType, base64] = match;
  return {
    mediaType,
    data: Uint8Array.from(Buffer.from(base64, 'base64')),
  };
}

function extensionFromFilename(filename?: string): string | null {
  if (!filename) {
    return null;
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return null;
  }

  return filename.slice(lastDot).toLowerCase();
}

function codeFenceLanguage(filename?: string, mediaType?: string): string {
  const extension = extensionFromFilename(filename);

  switch (extension) {
    case '.py':
      return 'py';
    case '.ts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js';
    case '.jsx':
      return 'jsx';
    case '.go':
      return 'go';
    case '.rs':
      return 'rust';
    case '.java':
      return 'java';
    case '.cs':
      return 'csharp';
    case '.cpp':
    case '.cxx':
    case '.cc':
    case '.c':
    case '.h':
    case '.hpp':
      return 'cpp';
    case '.swift':
      return 'swift';
    case '.kt':
    case '.kts':
      return 'kotlin';
    case '.rb':
      return 'ruby';
    case '.php':
      return 'php';
    case '.scala':
      return 'scala';
    case '.sql':
      return 'sql';
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.fish':
      return 'sh';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.json':
      return 'json';
    case '.toml':
      return 'toml';
    case '.ini':
    case '.conf':
    case '.cfg':
    case '.env':
    case '.example':
      return 'ini';
    case '.md':
    case '.mdx':
      return 'md';
    case '.csv':
      return 'csv';
    case '.log':
    case '.txt':
      return 'text';
    default:
      break;
  }

  if (mediaType?.startsWith('text/')) {
    return mediaType.slice('text/'.length);
  }

  if (mediaType === 'application/json') return 'json';
  if (mediaType?.includes('yaml')) return 'yaml';
  if (mediaType?.includes('toml')) return 'toml';
  if (mediaType?.includes('xml')) return 'xml';

  return 'text';
}

function isTextLikeFile(part: LanguageModelV4FilePart): boolean {
  if (part.mediaType.startsWith('image/') || part.mediaType.startsWith('audio/') || part.mediaType === 'application/pdf') {
    return false;
  }

  if (TEXT_ATTACHMENT_MIME_TYPES.has(part.mediaType) || part.mediaType.startsWith('text/')) {
    return true;
  }

  const extension = extensionFromFilename(part.filename);
  return extension ? TEXT_ATTACHMENT_EXTENSIONS.has(extension) : false;
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

function maybeDecodeBase64Text(value: string): string {
  try {
    const decoded = decodeUtf8(Uint8Array.from(Buffer.from(value, 'base64')));
    if (decoded.includes('\uFFFD')) {
      return value;
    }

    return decoded;
  } catch {
    return value;
  }
}

function textAttachmentMaxChars(): number {
  const configured = Number.parseInt(process.env.CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_ATTACHMENT_MAX_CHARS;
}

function textAttachmentMaxBytes(): number {
  const configured = Number.parseInt(process.env.CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_ATTACHMENT_MAX_BYTES;
}

function filePartToTextPart(part: LanguageModelV4FilePart, text: string): LanguageModelV4TextPart {
  const normalizedText = text.slice(0, textAttachmentMaxChars());
  const truncatedNotice =
    text.length > normalizedText.length
      ? `\n\n[File truncated to ${normalizedText.length.toLocaleString()} characters before sending to the model.]`
      : '';
  const label = part.filename || 'attached-file';
  const language = codeFenceLanguage(part.filename, part.mediaType);

  return {
    type: 'text',
    text: [
      `Attached file: ${label}`,
      `Media type: ${part.mediaType}`,
      'Contents:',
      `\`\`\`${language}`,
      normalizedText,
      '```',
      truncatedNotice,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function unsupportedFilePartToTextPart(part: LanguageModelV4FilePart): LanguageModelV4TextPart {
  const label = part.filename || 'attached-file';

  return {
    type: 'text',
    text: [
      `Attached file: ${label}`,
      `Media type: ${part.mediaType}`,
      'This file type is not passed through natively for this OpenAI-compatible chat endpoint.',
      'If you need this content analyzed, convert it to plain text/markdown/code/CSV/JSON or use a dedicated parser/tool pipeline.',
    ].join('\n'),
  };
}

function normalizeFilePart(part: LanguageModelV4FilePart): LanguageModelV4FilePart | LanguageModelV4TextPart {
  const rawData = part.data as
    | LanguageModelV4FilePart['data']
    | string
    | URL
    | Uint8Array
    | ArrayBuffer;

  if (typeof rawData === 'string') {
    const parsedDataUrl = parseDataUrl(rawData);
    if (parsedDataUrl) {
      if (isTextLikeFile(part)) {
        if (parsedDataUrl.data.byteLength > textAttachmentMaxBytes()) {
          return filePartToTextPart(
            part,
            `[Attachment omitted: decoded file size ${parsedDataUrl.data.byteLength.toLocaleString()} bytes exceeds the configured limit of ${textAttachmentMaxBytes().toLocaleString()} bytes for inline text fallback.]`,
          );
        }

        return filePartToTextPart(part, decodeUtf8(parsedDataUrl.data));
      }

      if (part.mediaType?.startsWith('image/')) {
        return {
          ...part,
          data: {
            type: 'url',
            url: new URL(`data:${part.mediaType};base64,${rawData}`),
          },
        };
      }

      return {
        ...part,
        mediaType: part.mediaType || parsedDataUrl.mediaType || 'application/octet-stream',
        data: {
          type: 'data',
          data: parsedDataUrl.data,
        },
      };
    }

    if (part.mediaType?.startsWith('image/') || part.mediaType?.startsWith('audio/') || part.mediaType === 'application/pdf') {
      if (part.mediaType.startsWith('image/')) {
        return {
          ...part,
          data: {
            type: 'url',
            url: new URL(`data:${part.mediaType};base64,${rawData}`),
          },
        };
      }

      return {
        ...part,
        data: {
          type: 'data',
          data: Uint8Array.from(Buffer.from(rawData, 'base64')),
        },
      };
    }

    if (isTextLikeFile(part)) {
      const decoded = maybeDecodeBase64Text(rawData);
      const byteLength = Buffer.byteLength(decoded, 'utf8');
      if (byteLength > textAttachmentMaxBytes()) {
        return filePartToTextPart(
          part,
          `[Attachment omitted: decoded file size ${byteLength.toLocaleString()} bytes exceeds the configured limit of ${textAttachmentMaxBytes().toLocaleString()} bytes for inline text fallback.]`,
        );
      }

      return filePartToTextPart(part, decoded);
    }

    try {
      return {
        ...part,
        data: {
          type: 'url',
          url: new URL(rawData),
        },
      };
    } catch {
      return unsupportedFilePartToTextPart(part);
    }
  }

  if (rawData instanceof URL) {
    if (isTextLikeFile(part)) {
      return filePartToTextPart(
        part,
        `[This text-like attachment is only available as a URL and could not be inlined automatically: ${rawData.toString()}]`,
      );
    }

    return {
      ...part,
      data: {
        type: 'url',
        url: rawData,
      },
    };
  }

  if (rawData instanceof Uint8Array) {
    if (isTextLikeFile(part)) {
      if (rawData.byteLength > textAttachmentMaxBytes()) {
        return filePartToTextPart(
          part,
          `[Attachment omitted: file size ${rawData.byteLength.toLocaleString()} bytes exceeds the configured limit of ${textAttachmentMaxBytes().toLocaleString()} bytes for inline text fallback.]`,
        );
      }

      return filePartToTextPart(part, decodeUtf8(rawData));
    }

    return {
      ...part,
      data: {
        type: 'data',
        data: rawData,
      },
    };
  }

  if (rawData instanceof ArrayBuffer) {
    if (isTextLikeFile(part)) {
      const bytes = new Uint8Array(rawData);
      if (bytes.byteLength > textAttachmentMaxBytes()) {
        return filePartToTextPart(
          part,
          `[Attachment omitted: file size ${bytes.byteLength.toLocaleString()} bytes exceeds the configured limit of ${textAttachmentMaxBytes().toLocaleString()} bytes for inline text fallback.]`,
        );
      }

      return filePartToTextPart(part, decodeUtf8(bytes));
    }

    return {
      ...part,
      data: {
        type: 'data',
        data: new Uint8Array(rawData),
      },
    };
  }

  return unsupportedFilePartToTextPart(part);
}

function normalizePromptParts(prompt: LanguageModelV4Prompt): LanguageModelV4Prompt {
  return prompt.map(message => {
    if (message.role !== 'user') {
      return message;
    }

    return {
      ...message,
      content: message.content.map(part => {
        const maybeImagePart = part as unknown as {
          type?: 'image';
          image?: string | URL | Uint8Array | ArrayBuffer;
          mimeType?: string;
          providerOptions?: LanguageModelV4FilePart['providerOptions'];
        };

        if (maybeImagePart.type !== 'image' || maybeImagePart.image == null) {
          if (part.type === 'file') {
            return normalizeFilePart(part);
          }

          return part;
        }

        const data =
          maybeImagePart.image instanceof URL
            ? ({ type: 'url', url: maybeImagePart.image } as const)
            : ({
                type: 'data',
                data:
                  maybeImagePart.image instanceof ArrayBuffer
                    ? new Uint8Array(maybeImagePart.image)
                    : maybeImagePart.image,
              } as const);

        const normalizedPart: LanguageModelV4FilePart = {
          type: 'file' as const,
          data,
          mediaType: maybeImagePart.mimeType ?? 'image/png',
          providerOptions: maybeImagePart.providerOptions,
        };

        return normalizedPart;
      }),
    };
  });
}

function normalizeCallOptions(options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  return {
    ...options,
    prompt: normalizePromptParts(options.prompt),
  };
}

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

  getAttachmentCapabilities(): AttachmentCapabilities {
    const models = cachedModels ?? FALLBACK_MODELS;
    return {
      [customOpenAIProviderId]: models,
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
    const model = createOpenAI({
      apiKey,
      baseURL: this.buildUrl(),
      headers,
    }).chat(modelId);

    return {
      ...model,
      doGenerate: (options: LanguageModelV4CallOptions) => model.doGenerate(normalizeCallOptions(options)),
      doStream: (options: LanguageModelV4CallOptions) => model.doStream(normalizeCallOptions(options)),
    };
  }
}

export const customOpenAIGateway = new CustomOpenAIGateway();
