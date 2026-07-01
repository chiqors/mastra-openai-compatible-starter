# mastra-openai-compatible-starter

A [Mastra](https://mastra.ai/) starter for custom OpenAI-compatible servers.

This repo shows how to:

- register a custom Mastra gateway for an OpenAI-compatible API
- configure the gateway ID and provider ID with environment variables
- fetch available models dynamically from `/v1/models`
- use the configured gateway as the default model source for agents and scorers
- run Mastra Studio locally with Bun

## Features

- OpenAI-compatible gateway built with `@ai-sdk/openai`
- Dynamic model discovery from your server's `/models` endpoint
- In-memory model list caching with request de-duplication
- Configurable gateway ID, provider ID, and default model
- General-purpose chat agent for uploaded images and files
- Automatic text fallback for supported non-image chat attachments
- Sample weather agent, workflow, tool, and scorer
- Local observability storage via DuckDB

## Requirements

- Bun
- Node.js `>=24.13.0`
- An OpenAI-compatible API server

## Quick start

1. Install dependencies:

```sh
bun install
```

2. Copy the example environment file:

```sh
cp .env.example .env
```

3. Update `.env` with your API server details.

Minimal example:

```env
CUSTOM_OPENAI_GATEWAY_ID=custom
CUSTOM_OPENAI_PROVIDER_ID=openai
CUSTOM_OPENAI_API_KEY=your-api-key
CUSTOM_OPENAI_BASE_URL=https://your-openai-compatible-server/v1
CUSTOM_OPENAI_DEFAULT_MODEL=gpt-5.4
```

4. Start Mastra Studio:

```sh
bun run dev
```

5. Open [http://localhost:4111](http://localhost:4111)

The starter includes:

- `general-agent` for normal chat, uploaded images, and files
- `weather-agent` as a focused example with tools, workflow, and scorers

## Attachment support

This starter is designed to feel like a chat-first file upload workflow:

- Images are sent as native multimodal inputs for vision-capable models.
- Text-like files are inlined into the prompt automatically for OpenAI-compatible chat endpoints that do not support those file types natively.
- PDFs are passed through as file attachments when supported by the provider path.
- Office documents and generic binary files are not fully supported yet and usually need a parser/tool workflow.

### Current support matrix

| File type | Status | Behavior |
| --- | --- | --- |
| Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) | Supported | Sent as multimodal image input |
| Source code (`.py`, `.ts`, `.tsx`, `.js`, `.go`, `.rs`, `.java`, `.cs`, etc.) | Supported | Inlined into the prompt as text |
| Config files (`.yaml`, `.yml`, `.json`, `.toml`, `.ini`, `.env`, `.env.example`) | Supported | Inlined into the prompt as text |
| Documentation (`.md`, `.mdx`, `.txt`) | Supported | Inlined into the prompt as text |
| Logs (`.log`) | Supported | Inlined into the prompt as text |
| Data files (`.csv`, `.json`) | Supported | Inlined into the prompt as text |
| PDFs (`.pdf`) | Basic | Sent as PDF file parts when supported by the model path |
| Office docs (`.docx`, `.xlsx`, `.pptx`) | Limited | Not automatically parsed yet |
| Generic binary files | Limited | Not automatically parsed yet |

### Text attachment fallback limits

To keep prompts safe and predictable, text-like attachments are capped before being inlined:

- `CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES`
  Default: `256000`
- `CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS`
  Default: `20000`

If a file exceeds the byte limit, the gateway inserts a note explaining that the attachment was omitted from inline fallback.

## Configuration

These environment variables control the custom gateway:

```env
# Gateway/provider IDs used in Mastra model strings
CUSTOM_OPENAI_GATEWAY_ID=custom
CUSTOM_OPENAI_GATEWAY_NAME=Custom OpenAI-Compatible Gateway
CUSTOM_OPENAI_PROVIDER_ID=openai
CUSTOM_OPENAI_PROVIDER_NAME=OpenAI Compatible

# API auth and base URL
CUSTOM_OPENAI_API_KEY=your-api-key
CUSTOM_OPENAI_BASE_URL=https://your-openai-compatible-server/v1

# Default model used by the sample weather agent and scorer
CUSTOM_OPENAI_DEFAULT_MODEL=gpt-5.4

# Optional cache TTL for GET /models in milliseconds
CUSTOM_OPENAI_MODEL_CACHE_TTL_MS=300000

# Optional text attachment fallback limits
CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES=256000
CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS=20000

# Optional compatibility fallback
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-openai-compatible-server/v1
```

## Model format

Mastra expects models in `gateway/provider/model` format for this gateway setup.

For example:

```text
custom/openai/gpt-5.4
```

If you change:

- `CUSTOM_OPENAI_GATEWAY_ID`
- `CUSTOM_OPENAI_PROVIDER_ID`
- `CUSTOM_OPENAI_DEFAULT_MODEL`

then the sample agent and scorer will follow automatically.

## Dynamic model discovery

The custom gateway fetches available models from:

```text
<CUSTOM_OPENAI_BASE_URL>/models
```

Behavior:

- sends `Authorization: Bearer <api-key>`
- filters models to `supported_endpoint_types` that include `openai` when present
- de-duplicates model IDs
- caches results in memory for `CUSTOM_OPENAI_MODEL_CACHE_TTL_MS`
- falls back to `gpt-5.4` if the endpoint is temporarily unavailable

## Voice

By default, the sample agent does not configure a Mastra voice provider, so Studio uses browser speech recognition as a fallback.

If you want to switch the agent to a Mastra-managed voice provider such as `OpenAIVoice`, see:

- [Voice setup](docs/voice.md)

## Model capabilities

For a verified summary of what the currently configured upstream models can do, and which attachment behaviors come from this starter's gateway fallback, see:

- [Model capabilities](docs/model-capabilities.md)
- [PDF skills](docs/pdf-skills.md)
- [DOCX skills](docs/docx-skills.md)

## Scripts

```sh
bun run dev
bun run build
bun run start
```

## Using your Mastra fork

This starter can use fork-built Mastra tarballs from either:

- local `.tgz` files in `.local-packs`
- GitHub release assets from your Mastra fork

### Pack fork tarballs locally

By default, the helper script reads from `../mastra`:

```sh
bun run mastra:release-fork
```

This packs fresh tarballs into `.local-packs`.

The local pack helper now:

- rebuilds the Studio bundle before packing
- writes content-hashed tarball filenames so Bun does not reuse stale local packages
- writes `.local-packs/mastra-fork-manifest.json` so `mastra:deps:local` can resolve the newest files automatically

If your fork lives somewhere else:

```sh
MASTRA_FORK_DIR=/absolute/path/to/mastra bun run mastra:release-fork
```

Then point this starter back to local tarballs:

```sh
bun run mastra:deps:local
bun install
```

### Upload tarballs to a GitHub release

To upload the packed tarballs to your fork's GitHub release assets:

```sh
MASTRA_RELEASE_TAG=fix-composer-model-picker-hydration \
MASTRA_GITHUB_REPO=chiqors/mastra \
bun run mastra:release-fork -- --upload
```

That creates or updates a release and uploads:

- `mastra-<version>-<commit>-<hash>.tgz`
- `mastra-core-<version>-<commit>-<hash>.tgz`

These hashed asset names are intentional. They prevent stale package reuse and let the starter install the exact fork build you just published.

### Use GitHub release assets as dependencies

After uploading release assets:

```sh
MASTRA_RELEASE_TAG=fix-composer-model-picker-hydration \
MASTRA_GITHUB_REPO=chiqors/mastra \
bun run mastra:deps:release

bun install
```

This updates `package.json` to download `mastra` and `@mastra/core` directly from your fork's GitHub release assets.

The release helper resolves the actual asset names from the GitHub release metadata, so it can safely pick the newest hashed tarballs instead of older static asset names.

Recommended verification:

```sh
bun run build
```

The release-based dependency flow has been verified in this starter with Bun.

### Update to newer fork code

When your fork branch changes:

1. sync or rebuild the fork in `../mastra`
2. run:

```sh
bun run mastra:release-fork
bun run mastra:deps:local
bun install
```

Or, if you're using GitHub release assets:

```sh
MASTRA_RELEASE_TAG=<new-tag> \
MASTRA_GITHUB_REPO=<owner>/<repo> \
bun run mastra:deps:release
bun install
```

If you reuse the same release tag, re-run both commands after uploading updated assets so `package.json` and `bun.lock` point at the latest tarballs for that tag.

## Project structure

```text
src/mastra/
  agents/
  gateways/
  scorers/
  tools/
  workflows/
  index.ts
```

## Notes

- Bun automatically loads `.env`
- local observability data may create `*.duckdb` and `*.duckdb.wal` files
- those DuckDB files are gitignored in this repo
- `.local-packs/mastra-fork-manifest.json` is local build metadata and is gitignored

## Learn more

- [Mastra documentation](https://mastra.ai/docs/)
- [Mastra Studio docs](https://mastra.ai/docs/studio/overview)
- [Mastra platform](https://projects.mastra.ai)
