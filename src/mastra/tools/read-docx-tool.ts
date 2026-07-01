import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readDocxFile } from '../lib/docx-reader';

export const readDocxTool = createTool({
  id: 'read-docx',
  description: 'Read a local DOCX file, extract its text, and return normalized structured output.',
  inputSchema: z.object({
    filePath: z.string().describe('Absolute path to a local .docx file'),
  }),
  outputSchema: z.object({
    filePath: z.string(),
    text: z.string(),
    sections: z.array(
      z.object({
        heading: z.string(),
        content: z.string(),
      }),
    ),
    metadata: z.object({
      title: z.string().nullable(),
      subject: z.string().nullable(),
      author: z.string().nullable(),
      keywords: z.string().nullable(),
      description: z.string().nullable(),
      created: z.string().nullable(),
      modified: z.string().nullable(),
    }),
    technical: z.object({
      extractedWith: z.literal('textutil'),
      inspectedZipEntries: z.array(z.string()),
      hasDocumentXml: z.boolean(),
      hasCoreMetadata: z.boolean(),
    }),
    warnings: z.array(z.string()),
  }),
  execute: async ({ filePath }) => {
    console.info(`[read-docx tool] Invoked for ${filePath}`);
    return await readDocxFile(filePath);
  },
});
