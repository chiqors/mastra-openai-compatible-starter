import type {
  LanguageModelV4CallOptions,
  LanguageModelV4FilePart,
  LanguageModelV4Prompt,
  LanguageModelV4TextPart,
} from '@ai-sdk/provider';
import {
  decodeUtf8,
  isDocxLikeFile,
  isPdfLikeFile,
  isTextLikeFile,
  maybeDecodeBase64Text,
  parseDataUrl,
} from './file-utils';
import {
  filePartToTextPart,
  oversizeTextAttachmentNotice,
  persistAttachmentToTempFile,
  toolCallHintForLocalFile,
  unsupportedFilePartToTextPart,
  urlOnlyToolHint,
} from './attachment-prompts';
import { textAttachmentMaxBytes } from './config';

function normalizeBinaryFilePart(part: LanguageModelV4FilePart, data: Uint8Array) {
  return {
    ...part,
    data: {
      type: 'data' as const,
      data,
    },
  };
}

function normalizeImageAsUrl(part: LanguageModelV4FilePart, rawData: string) {
  return {
    ...part,
    data: {
      type: 'url' as const,
      url: new URL(`data:${part.mediaType};base64,${rawData}`),
    },
  };
}

function maybeToolHintForDocument(part: LanguageModelV4FilePart, data: Uint8Array): LanguageModelV4TextPart | null {
  if (isDocxLikeFile(part)) {
    const filePath = persistAttachmentToTempFile(data, part.filename || 'attachment.docx');
    return toolCallHintForLocalFile(part, filePath, 'read-docx');
  }

  if (isPdfLikeFile(part)) {
    const filePath = persistAttachmentToTempFile(data, part.filename || 'attachment.pdf');
    return toolCallHintForLocalFile(part, filePath, 'read-pdf');
  }

  return null;
}

async function normalizeFilePart(part: LanguageModelV4FilePart): Promise<LanguageModelV4FilePart | LanguageModelV4TextPart> {
  const rawData = part.data as
    | LanguageModelV4FilePart['data']
    | string
    | URL
    | Uint8Array
    | ArrayBuffer;

  if (typeof rawData === 'string') {
    const parsedDataUrl = parseDataUrl(rawData);
    if (parsedDataUrl) {
      const toolHint = maybeToolHintForDocument(part, parsedDataUrl.data);
      if (toolHint) {
        return toolHint;
      }

      if (isTextLikeFile(part)) {
        if (parsedDataUrl.data.byteLength > textAttachmentMaxBytes()) {
          return oversizeTextAttachmentNotice(part, parsedDataUrl.data.byteLength);
        }

        return filePartToTextPart(part, decodeUtf8(parsedDataUrl.data));
      }

      if (part.mediaType?.startsWith('image/')) {
        return normalizeImageAsUrl(part, rawData);
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

    if (isDocxLikeFile(part)) {
      return toolCallHintForLocalFile(
        part,
        persistAttachmentToTempFile(Uint8Array.from(Buffer.from(rawData, 'base64')), part.filename || 'attachment.docx'),
        'read-docx',
      );
    }

    if (isPdfLikeFile(part)) {
      return toolCallHintForLocalFile(
        part,
        persistAttachmentToTempFile(Uint8Array.from(Buffer.from(rawData, 'base64')), part.filename || 'attachment.pdf'),
        'read-pdf',
      );
    }

    if (part.mediaType?.startsWith('image/') || part.mediaType?.startsWith('audio/')) {
      if (part.mediaType.startsWith('image/')) {
        return normalizeImageAsUrl(part, rawData);
      }

      return normalizeBinaryFilePart(part, Uint8Array.from(Buffer.from(rawData, 'base64')));
    }

    if (isTextLikeFile(part)) {
      const decoded = maybeDecodeBase64Text(rawData);
      const byteLength = Buffer.byteLength(decoded, 'utf8');
      if (byteLength > textAttachmentMaxBytes()) {
        return oversizeTextAttachmentNotice(part, byteLength);
      }

      return filePartToTextPart(part, decoded);
    }

    try {
      const url = new URL(rawData).toString();
      if (isDocxLikeFile(part)) return urlOnlyToolHint(part, url, 'read-docx');
      if (isPdfLikeFile(part)) return urlOnlyToolHint(part, url, 'read-pdf');
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
    if (isDocxLikeFile(part)) {
      return urlOnlyToolHint(part, rawData.toString(), 'read-docx');
    }

    if (isPdfLikeFile(part)) {
      return urlOnlyToolHint(part, rawData.toString(), 'read-pdf');
    }

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
    const toolHint = maybeToolHintForDocument(part, rawData);
    if (toolHint) {
      return toolHint;
    }

    if (isTextLikeFile(part)) {
      if (rawData.byteLength > textAttachmentMaxBytes()) {
        return oversizeTextAttachmentNotice(part, rawData.byteLength);
      }

      return filePartToTextPart(part, decodeUtf8(rawData));
    }

    return normalizeBinaryFilePart(part, rawData);
  }

  if (rawData instanceof ArrayBuffer) {
    const bytes = new Uint8Array(rawData);
    const toolHint = maybeToolHintForDocument(part, bytes);
    if (toolHint) {
      return toolHint;
    }

    if (isTextLikeFile(part)) {
      if (bytes.byteLength > textAttachmentMaxBytes()) {
        return oversizeTextAttachmentNotice(part, bytes.byteLength);
      }

      return filePartToTextPart(part, decodeUtf8(bytes));
    }

    return normalizeBinaryFilePart(part, bytes);
  }

  return unsupportedFilePartToTextPart(part);
}

async function normalizePromptParts(prompt: LanguageModelV4Prompt): Promise<LanguageModelV4Prompt> {
  return await Promise.all(
    prompt.map(async message => {
      if (message.role !== 'user') {
        return message;
      }

      return {
        ...message,
        content: await Promise.all(
          message.content.map(async part => {
            const maybeImagePart = part as unknown as {
              type?: 'image';
              image?: string | URL | Uint8Array | ArrayBuffer;
              mimeType?: string;
              providerOptions?: LanguageModelV4FilePart['providerOptions'];
            };

            if (maybeImagePart.type !== 'image' || maybeImagePart.image == null) {
              if (part.type === 'file') {
                return await normalizeFilePart(part);
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
        ),
      };
    }),
  );
}

export async function normalizeCallOptions(options: LanguageModelV4CallOptions): Promise<LanguageModelV4CallOptions> {
  return {
    ...options,
    prompt: await normalizePromptParts(options.prompt),
  };
}
