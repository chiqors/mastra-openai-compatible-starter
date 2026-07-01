# Model Capabilities

This document describes what is currently verified for the configured OpenAI-compatible server, and what behavior is added by this starter itself.

## Important distinction

There are two separate layers involved when you upload content in Studio:

1. Your upstream OpenAI-compatible model server
2. This starter's custom Mastra gateway

That means some capabilities are native to the model, while others are provided by gateway fallback behavior in this repo.

## How to think about model support

This starter is designed for custom OpenAI-compatible providers, so the exact model list depends on the upstream server you connect to.

Because of that, this document intentionally does not hardcode specific model names. Instead, treat `/v1/models` as the source for discovery, then verify the behaviors you care about against the actual endpoint you configured.

## What this starter adds on top

The custom gateway in this repo expands chat attachment behavior so uploads feel more like a general-purpose assistant:

| Input type | Where support comes from | Current behavior |
| --- | --- | --- |
| Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) | Model + gateway | Sent as multimodal image input |
| Source code files | Gateway fallback | File contents are inlined into prompt text |
| Config files | Gateway fallback | File contents are inlined into prompt text |
| Markdown / text / logs | Gateway fallback | File contents are inlined into prompt text |
| CSV / JSON | Gateway fallback | File contents are inlined into prompt text |
| PDFs | Skill/tool pipeline recommended | Do not treat PDFs like normal text files; prefer a PDF-reading skill or extraction pipeline |
| Office docs / binary files | Not implemented generally | Usually needs a parser or tool workflow |

## What this means in practice

- If a model supports plain chat, this starter can usually make text-like uploads useful by inlining them.
- Image understanding depends on actual upstream multimodal support and should be tested against your configured provider.
- Generic file upload support here does not mean the upstream server natively supports arbitrary file parts.
- A model being listed in `/models` does not guarantee every endpoint or modality is actually available.
- For PDFs specifically, a tool-assisted path is usually the right approach: extract text, render pages, or run a dedicated PDF skill before asking the model to reason over the contents.

## Re-testing checklist

When you change providers or publish a new gateway build, re-check:

1. `GET /v1/models`
2. `POST /v1/chat/completions` with plain text
3. `POST /v1/chat/completions` with an image
4. Any endpoint-specific features such as image generation
