
import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { generalAgent } from './agents/general-agent';
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';
import { customOpenAIGateway, customOpenAIGatewayId } from './gateways/custom-openai-gateway';

type StudioUser = {
  id: string;
  name: string;
  role: 'admin';
};

const studioAuthToken = process.env.MASTRA_STUDIO_AUTH_TOKEN;

if (!studioAuthToken) {
  console.warn(
    'MASTRA_STUDIO_AUTH_TOKEN is not set. Studio auth is enabled, but no valid login token is configured yet.',
  );
}

const studioTokens = studioAuthToken
  ? {
      [studioAuthToken]: {
        id: 'studio-admin',
        name: 'Studio Admin',
        role: 'admin',
      } satisfies StudioUser,
    }
  : {};

export const mastra = new Mastra({
  server: {
    auth: new SimpleAuth<StudioUser>({
      tokens: studioTokens,
    }),
  },
  workflows: { weatherWorkflow },
  agents: { weatherAgent, generalAgent },
  scorers: { toolCallAppropriatenessScorer, completenessScorer, translationScorer },
  gateways: {
    [customOpenAIGatewayId]: customOpenAIGateway,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: "file:./mastra.db",
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
