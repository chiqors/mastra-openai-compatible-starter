import type { LanguageModelV4FilePart } from '@ai-sdk/provider';

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

export function parseDataUrl(value: string): { mediaType?: string; data: Uint8Array } | null {
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

export function extensionFromFilename(filename?: string): string | null {
  if (!filename) {
    return null;
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return null;
  }

  return filename.slice(lastDot).toLowerCase();
}

export function isDocxLikeFile(part: LanguageModelV4FilePart): boolean {
  return (
    part.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extensionFromFilename(part.filename) === '.docx'
  );
}

export function isPdfLikeFile(part: LanguageModelV4FilePart): boolean {
  return part.mediaType === 'application/pdf' || extensionFromFilename(part.filename) === '.pdf';
}

export function codeFenceLanguage(filename?: string, mediaType?: string): string {
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

export function isTextLikeFile(part: LanguageModelV4FilePart): boolean {
  if (part.mediaType.startsWith('image/') || part.mediaType.startsWith('audio/') || isPdfLikeFile(part) || isDocxLikeFile(part)) {
    return false;
  }

  if (TEXT_ATTACHMENT_MIME_TYPES.has(part.mediaType) || part.mediaType.startsWith('text/')) {
    return true;
  }

  const extension = extensionFromFilename(part.filename);
  return extension ? TEXT_ATTACHMENT_EXTENSIONS.has(extension) : false;
}

export function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

export function maybeDecodeBase64Text(value: string): string {
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
