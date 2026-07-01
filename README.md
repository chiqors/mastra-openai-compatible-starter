# mastra-openai-compatible-starter

A [Mastra](https://mastra.ai/) starter for custom OpenAI-compatible servers.

This project focuses on two things:

- running Mastra against an OpenAI-compatible endpoint instead of the standard OpenAI API
- using a forked Mastra repo to carry fixes and improvements for custom endpoint support, system behavior, and a few Studio UI details

## What this starter includes

- a custom Mastra gateway built with `@ai-sdk/openai`
- dynamic model discovery from your upstream `/models` endpoint
- sample agents, workflows, and scorers
- local observability storage with DuckDB
- optional `SimpleAuth` support for Studio login

## Quick start

1. Install dependencies:

```sh
bun install
```

2. Copy the example environment file:

```sh
cp .env.example .env
```

3. Set your OpenAI-compatible server values in `.env`.

4. Start Studio:

```sh
bun run dev
```

5. Open [http://localhost:4111](http://localhost:4111)

## Scripts

```sh
bun run dev
bun run build
bun run start
```

## Docs

- [Configuration](docs/configuration.md)
- [Attachment support](docs/attachments.md)
- [Using the forked Mastra repo](docs/forked-mastra.md)
- [Voice setup](docs/voice.md)
- [Model capabilities](docs/model-capabilities.md)
- [PDF skills](docs/pdf-skills.md)
- [DOCX skills](docs/docx-skills.md)

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

## Learn more

- [Mastra documentation](https://mastra.ai/docs/)
- [Mastra Studio docs](https://mastra.ai/docs/studio/overview)
