import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type DocxSection = {
  heading: string;
  content: string;
};

export type DocxReadResult = {
  filePath: string;
  text: string;
  sections: DocxSection[];
  metadata: {
    title: string | null;
    subject: string | null;
    author: string | null;
    keywords: string | null;
    description: string | null;
    created: string | null;
    modified: string | null;
  };
  technical: {
    extractedWith: 'textutil';
    inspectedZipEntries: string[];
    hasDocumentXml: boolean;
    hasCoreMetadata: boolean;
  };
  warnings: string[];
};

type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number;
};

function run(command: string, args: string[]): RunResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    return {
      ok: false,
      stdout: result.stdout || '',
      stderr: result.stderr || result.error.message,
      status: result.status ?? 1,
    };
  }

  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 0,
  };
}

function extractZipEntry(filePath: string, entryPath: string): RunResult {
  return run('unzip', ['-p', filePath, entryPath]);
}

function parseCoreMetadata(xml: string) {
  if (!xml) {
    return {
      title: null,
      subject: null,
      author: null,
      keywords: null,
      description: null,
      created: null,
      modified: null,
    };
  }

  const readTag = (tag: string) => {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1]?.trim() || null;
  };

  return {
    title: readTag('dc:title'),
    subject: readTag('dc:subject'),
    author: readTag('dc:creator'),
    keywords: readTag('cp:keywords'),
    description: readTag('dc:description'),
    created: readTag('dcterms:created'),
    modified: readTag('dcterms:modified'),
  };
}

function summarizeSections(text: string): DocxSection[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const sections: DocxSection[] = [];
  let current: DocxSection | null = null;

  for (const line of lines) {
    const looksLikeHeading =
      line.length <= 80 &&
      !line.includes('@') &&
      !/^[-*•]/.test(line) &&
      /^[A-Za-z0-9 &/()+,:.-]+$/.test(line) &&
      line === line.toUpperCase();

    if (looksLikeHeading) {
      current = { heading: line, content: '' };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { heading: 'INTRO', content: '' };
      sections.push(current);
    }

    current.content = current.content ? `${current.content}\n${line}` : line;
  }

  return sections;
}

export async function readDocxFile(filePath: string): Promise<DocxReadResult> {
  const resolvedPath = path.resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  if (path.extname(resolvedPath).toLowerCase() !== '.docx') {
    throw new Error(`Expected a .docx file: ${resolvedPath}`);
  }

  const warnings: string[] = [];
  const textResult = run('textutil', ['-convert', 'txt', '-stdout', resolvedPath]);
  if (!textResult.ok) {
    throw new Error(`Failed to extract text with textutil: ${textResult.stderr}`.trim());
  }

  const documentXmlResult = extractZipEntry(resolvedPath, 'word/document.xml');
  if (!documentXmlResult.ok) {
    warnings.push(`Unable to inspect word/document.xml: ${documentXmlResult.stderr.trim() || 'unknown error'}`);
  }

  const coreXmlResult = extractZipEntry(resolvedPath, 'docProps/core.xml');
  if (!coreXmlResult.ok) {
    warnings.push(`Unable to inspect docProps/core.xml: ${coreXmlResult.stderr.trim() || 'not present'}`);
  }

  const text = textResult.stdout.trim();

  return {
    filePath: resolvedPath,
    text,
    sections: summarizeSections(text),
    metadata: parseCoreMetadata(coreXmlResult.stdout),
    technical: {
      extractedWith: 'textutil',
      inspectedZipEntries: ['word/document.xml', 'docProps/core.xml'],
      hasDocumentXml: documentXmlResult.ok,
      hasCoreMetadata: coreXmlResult.ok,
    },
    warnings,
  };
}

export async function readDocxBytes(data: Uint8Array, filename = 'attachment.docx'): Promise<DocxReadResult> {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'mastra-docx-'));
  const tempPath = path.join(tempDir, filename.endsWith('.docx') ? filename : `${filename}.docx`);

  try {
    writeFileSync(tempPath, data);
    return await readDocxFile(tempPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
