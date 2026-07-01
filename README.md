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
- Sample weather agent, workflow, tool, and scorer
- Local observability storage via DuckDB

## Requirements

- Bun
- Node.js `>=22.13.0`
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

## Scripts

```sh
bun run dev
bun run build
bun run start
```

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

## Learn more

- [Mastra documentation](https://mastra.ai/docs/)
- [Mastra Studio docs](https://mastra.ai/docs/studio/overview)
- [Mastra platform](https://projects.mastra.ai)
