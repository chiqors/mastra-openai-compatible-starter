import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type PdfSection = {
  heading: string;
  content: string;
};

export type PdfReadResult = {
  filePath: string;
  text: string;
  sections: PdfSection[];
  metadata: {
    pageCount: number;
    title: string | null;
    author: string | null;
    subject: string | null;
    creator: string | null;
    producer: string | null;
  };
  technical: {
    extractedWith: 'swift-pdfkit';
    hasExtractedText: boolean;
  };
  warnings: string[];
};

type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number;
};

function run(command: string, args: string[], input?: string): RunResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 20 * 1024 * 1024,
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

function summarizeSections(text: string): PdfSection[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const sections: PdfSection[] = [];
  let current: PdfSection | null = null;

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

const SWIFT_PDF_READER = `
import Foundation
import PDFKit

struct Output: Codable {
  struct Metadata: Codable {
    let pageCount: Int
    let title: String?
    let author: String?
    let subject: String?
    let creator: String?
    let producer: String?
  }

  let text: String
  let metadata: Metadata
}

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)

guard let document = PDFDocument(url: url) else {
  fputs("Unable to open PDF at \\(path)\\n", stderr)
  exit(1)
}

let attributes = document.documentAttributes ?? [:]
let output = Output(
  text: document.string ?? "",
  metadata: .init(
    pageCount: document.pageCount,
    title: attributes[PDFDocumentAttribute.titleAttribute] as? String,
    author: attributes[PDFDocumentAttribute.authorAttribute] as? String,
    subject: attributes[PDFDocumentAttribute.subjectAttribute] as? String,
    creator: attributes[PDFDocumentAttribute.creatorAttribute] as? String,
    producer: attributes[PDFDocumentAttribute.producerAttribute] as? String
  )
)

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(output)
FileHandle.standardOutput.write(data)
`;

type SwiftPdfPayload = {
  text: string;
  metadata: {
    pageCount: number;
    title?: string | null;
    author?: string | null;
    subject?: string | null;
    creator?: string | null;
    producer?: string | null;
  };
};

function extractWithSwiftPdfKit(filePath: string): SwiftPdfPayload {
  const result = run('swift', ['-', filePath], SWIFT_PDF_READER);
  if (!result.ok) {
    throw new Error(`Failed to extract PDF with Swift/PDFKit: ${result.stderr}`.trim());
  }

  return JSON.parse(result.stdout) as SwiftPdfPayload;
}

export async function readPdfFile(filePath: string): Promise<PdfReadResult> {
  const resolvedPath = path.resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  if (path.extname(resolvedPath).toLowerCase() !== '.pdf') {
    throw new Error(`Expected a .pdf file: ${resolvedPath}`);
  }

  const warnings: string[] = [];
  const extracted = extractWithSwiftPdfKit(resolvedPath);
  const text = extracted.text.trim();

  if (!text) {
    warnings.push('No embedded text was extracted from this PDF. It may be scanned or image-based and may require OCR or page rendering.');
  }

  return {
    filePath: resolvedPath,
    text,
    sections: summarizeSections(text),
    metadata: {
      pageCount: extracted.metadata.pageCount,
      title: extracted.metadata.title ?? null,
      author: extracted.metadata.author ?? null,
      subject: extracted.metadata.subject ?? null,
      creator: extracted.metadata.creator ?? null,
      producer: extracted.metadata.producer ?? null,
    },
    technical: {
      extractedWith: 'swift-pdfkit',
      hasExtractedText: text.length > 0,
    },
    warnings,
  };
}
