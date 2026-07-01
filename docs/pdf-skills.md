# PDF Skills

PDF files should be treated as a skill or tool pipeline, not as normal text-editor-readable attachments.

## Why

Unlike `.ts`, `.json`, `.md`, or `.log`, a PDF is a document container with layout, embedded fonts, and page rendering concerns. In practice, reliable PDF understanding usually comes from preprocessing before the model reasons over the contents.

## Recommended approach

Use a PDF-reading skill or extraction pipeline that can do one or more of these steps:

1. Extract embedded text
2. Render pages to images when layout matters
3. Fall back to OCR when the PDF is image-based
4. Pass the extracted text or rendered pages to the model

## Technical implementation details

For a practical agent implementation, the PDF skill should be tool-driven with extraction handled in a dedicated helper.

Typical flow:

1. Run a dedicated extraction helper
2. Save normalized output such as plain text, markdown, or page images
3. Feed the extracted result into the agent or model

Useful tools and libraries:

- Python libraries:
  - `pdfplumber` for text extraction
  - `pypdf` for metadata and page access
  - `pdf2image` when rendering pages is needed
  - OCR tooling later if scanned PDFs matter
- Native CLI tools when available:
  - `pdfinfo`
  - `pdftotext`
  - `pdftoppm`
  - `mutool`
- macOS fallbacks:
  - `qlmanage` for page preview rendering
  - `PDFKit` through a small Swift script for text/page extraction

In this repo, the clean pattern is to keep PDF logic inside a dedicated Mastra helper and tool rather than inside the general OpenAI-compatible gateway.

Current implementation:

- shared reader: `src/mastra/lib/pdf-reader.ts`
- Mastra tool: `src/mastra/tools/read-pdf-tool.ts`

Current tool behavior:

- extracts embedded text and metadata with `PDFKit` through Swift
- returns normalized output with:
  - `text`
  - `sections`
  - `metadata`
  - `technical`
  - `warnings`

## Suggested output shape

A PDF skill helper can return output in this structure:

1. Accept a local file path
2. Detect whether embedded text is available
3. Extract text when possible
4. Render pages when layout inspection is needed
5. Return structured output such as:
   - `text`
   - `pages`
   - `metadata`
   - `warnings`

Example output shape:

```json
{
  "text": "full extracted text",
  "pages": [
    {
      "page": 1,
      "imagePath": "/tmp/doc-page-1.png"
    }
  ],
  "metadata": {
    "pageCount": 2,
    "title": null
  },
  "warnings": []
}
```

## What Codex-style workflows usually do

A practical PDF workflow often looks like:

1. Try native PDF metadata/text extraction tools
2. If that fails, render pages locally
3. If needed, inspect the rendered pages with a vision-capable model
4. Summarize or analyze the extracted result

## Guidance for this starter

- Do not treat PDFs as first-class inline text attachments
- Do not assume the upstream OpenAI-compatible endpoint natively supports PDF reasoning well
- Prefer a dedicated PDF skill whenever users want reliable PDF reading

## Good use cases

- Resume review from PDF
- Invoice or report summarization
- Multi-page document inspection
- PDFs where visual layout matters
