# Configuration

This starter uses a custom Mastra gateway for an OpenAI-compatible API.

## Core environment variables

```env
# Gateway/provider IDs used in Mastra model strings
CUSTOM_OPENAI_GATEWAY_ID=custom
CUSTOM_OPENAI_GATEWAY_NAME=Custom OpenAI-Compatible Gateway
CUSTOM_OPENAI_PROVIDER_ID=openai
CUSTOM_OPENAI_PROVIDER_NAME=OpenAI Compatible

# API auth and base URL
CUSTOM_OPENAI_API_KEY=your-api-key
CUSTOM_OPENAI_BASE_URL=https://your-openai-compatible-server/v1

# Default model used by the sample agent and scorer setup
CUSTOM_OPENAI_DEFAULT_MODEL=gpt-5.4

# Optional cache TTL for GET /models in milliseconds
CUSTOM_OPENAI_MODEL_CACHE_TTL_MS=300000

# Optional text attachment fallback limits
CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES=256000
CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS=20000

# Optional compatibility fallback
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-openai-compatible-server/v1

# Optional Studio login token when SimpleAuth is enabled
MASTRA_STUDIO_AUTH_TOKEN=your-secret-token
```

## Minimal example

```env
CUSTOM_OPENAI_GATEWAY_ID=custom
CUSTOM_OPENAI_PROVIDER_ID=openai
CUSTOM_OPENAI_API_KEY=your-api-key
CUSTOM_OPENAI_BASE_URL=https://your-openai-compatible-server/v1
CUSTOM_OPENAI_DEFAULT_MODEL=gpt-5.4
```

## Model format

Mastra expects models in `gateway/provider/model` format for this gateway setup.

Example:

```text
custom/openai/gpt-5.4
```

If you change:

- `CUSTOM_OPENAI_GATEWAY_ID`
- `CUSTOM_OPENAI_PROVIDER_ID`
- `CUSTOM_OPENAI_DEFAULT_MODEL`

the sample agent and scorer configuration follow automatically.

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

## Notes

- Bun automatically loads `.env`
- local observability data may create `*.duckdb` and `*.duckdb.wal` files
- `.local-packs/mastra-fork-manifest.json` is local build metadata and is gitignored
