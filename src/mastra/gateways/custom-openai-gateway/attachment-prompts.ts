import type { LanguageModelV4FilePart, LanguageModelV4TextPart } from '@ai-sdk/provider';
import path from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { codeFenceLanguage } from './file-utils';
import { textAttachmentMaxBytes, textAttachmentMaxChars } from './config';

function sanitizeFilename(filename?: string, fallback = 'attachment.bin'): string {
  const base = path.basename(filename || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base : fallback;
}

export function filePartToTextPart(part: LanguageModelV4FilePart, text: string): LanguageModelV4TextPart {
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

export function unsupportedFilePartToTextPart(part: LanguageModelV4FilePart): LanguageModelV4TextPart {
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

export function oversizeTextAttachmentNotice(part: LanguageModelV4FilePart, byteLength: number): LanguageModelV4TextPart {
  return filePartToTextPart(
    part,
    `[Attachment omitted: decoded file size ${byteLength.toLocaleString()} bytes exceeds the configured limit of ${textAttachmentMaxBytes().toLocaleString()} bytes for inline text fallback.]`,
  );
}

export function persistAttachmentToTempFile(data: Uint8Array, filename?: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mastra-upload-'));
  const target = path.join(dir, sanitizeFilename(filename));
  writeFileSync(target, Buffer.from(data));
  return target;
}

export function toolCallHintForLocalFile(
  part: LanguageModelV4FilePart,
  filePath: string,
  toolName: 'read-docx' | 'read-pdf',
): LanguageModelV4TextPart {
  const label = part.filename || path.basename(filePath);
  return {
    type: 'text',
    text: [
      `Attached file: ${label}`,
      `Media type: ${part.mediaType}`,
      `Local file path: ${filePath}`,
      `Use the ${toolName} tool with this exact filePath before answering in detail.`,
      'After the tool returns, base your answer on the tool output rather than guessing from the container format.',
    ].join('\n'),
  };
}

export function urlOnlyToolHint(
  part: LanguageModelV4FilePart,
  url: string,
  toolName: 'read-docx' | 'read-pdf',
): LanguageModelV4TextPart {
  const label = part.filename || 'attached-file';
  return {
    type: 'text',
    text: [
      `Attached file: ${label}`,
      `Media type: ${part.mediaType}`,
      `Remote URL: ${url}`,
      `This ${toolName === 'read-docx' ? 'DOCX' : 'PDF'} attachment is only available as a URL in this request, so the local file-reading tool cannot be called until the file is available on disk.`,
      'Explain that limitation and ask for a real upload or local file path if deeper extraction is needed.',
    ].join('\n'),
  };
}
