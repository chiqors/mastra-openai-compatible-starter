import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readPdfFile } from '../lib/pdf-reader';

export const readPdfTool = createTool({
  id: 'read-pdf',
  description: 'Read a local PDF file, extract embedded text when available, and return normalized structured output.',
  inputSchema: z.object({
    filePath: z.string().describe('Absolute path to a local .pdf file'),
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
      pageCount: z.number(),
      title: z.string().nullable(),
      author: z.string().nullable(),
      subject: z.string().nullable(),
      creator: z.string().nullable(),
      producer: z.string().nullable(),
    }),
    technical: z.object({
      extractedWith: z.literal('swift-pdfkit'),
      hasExtractedText: z.boolean(),
    }),
    warnings: z.array(z.string()),
  }),
  execute: async ({ filePath }) => {
    return await readPdfFile(filePath);
  },
});
