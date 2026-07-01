# DOCX Skills

DOCX files should be handled through a document-reading skill or extraction pipeline, not through the same path as plain text files.

## Why

A `.docx` file is a structured document package, not a plain text file. Even when it contains mostly readable text, the useful content is usually inside the document structure and should be extracted first.

## Recommended approach

Use a DOCX-reading skill or tool pipeline that can:

1. Extract document text cleanly
2. Preserve basic structure such as headings, lists, and paragraphs
3. Inspect document metadata when useful
4. Convert to plain text or markdown before model reasoning

## Technical implementation details

For a practical agent implementation, DOCX handling should be tool-driven with extraction handled in a dedicated helper.

Typical flow:

1. Run a dedicated extraction helper for the uploaded `.docx`
2. Convert the document into normalized text or markdown
3. Preserve useful structure for downstream summarization or rewriting
4. Send the extracted content to the agent or model

Useful tools and libraries:

- Native CLI tools:
  - `textutil -convert txt` on macOS for quick text extraction
  - `unzip -p` for inspecting `.docx` internals such as `word/document.xml`
- JavaScript libraries:
  - `mammoth` for clean DOCX-to-text or DOCX-to-HTML conversion
  - `jszip` for lower-level inspection when needed
- Python libraries:
  - `python-docx` for structural extraction
  - XML tooling if deeper parsing is needed

In this repo, DOCX logic should live in a dedicated Mastra helper and tool instead of being treated as a native general chat attachment.

Current implementation:

- shared reader: `src/mastra/lib/docx-reader.ts`
- Mastra tool: `src/mastra/tools/read-docx-tool.ts`

Current tool behavior:

- extracts plain text with `textutil`
- inspects `word/document.xml`
- attempts to inspect `docProps/core.xml`
- returns normalized output with:
  - `text`
  - `sections`
  - `metadata`
  - `technical`
  - `warnings`

## Suggested output shape

A DOCX skill helper can follow this structure:

1. Accept a local file path
2. Extract plain text
3. Optionally preserve headings, bullets, and sections
4. Return structured output such as:
   - `text`
   - `sections`
   - `metadata`
   - `warnings`

Example output shape:

```json
{
  "text": "full extracted text",
  "sections": [
    {
      "heading": "Summary",
      "content": "..."
    }
  ],
  "metadata": {
    "title": null,
    "author": null
  },
  "warnings": []
}
```

## What Codex-style workflows usually do

A practical DOCX workflow often looks like:

1. Inspect the document container or XML when needed
2. Use a local conversion tool to extract readable text
3. Preserve enough structure for summarization or rewriting
4. Ask the model to analyze the extracted content

## Guidance for this starter

- Do not classify `.docx` as a normal text-editor-readable attachment
- Do not rely on raw DOCX bytes being useful to the model
- Prefer extraction first, then send the extracted text to the model

## Good use cases

- Resume and CV review
- Proposal summarization
- Contract draft inspection
- Converting Word content into markdown or structured text
