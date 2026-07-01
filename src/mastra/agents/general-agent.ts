import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { customOpenAIDefaultModel } from '../gateways/custom-openai-gateway';
import { readDocxTool } from '../tools/read-docx-tool';
import { readPdfTool } from '../tools/read-pdf-tool';

export const generalAgent = new Agent({
  id: 'general-agent',
  name: 'General Agent',
  instructions: `You are a general-purpose AI assistant.

You can help with writing, analysis, brainstorming, summarization, explanation, extraction, and structured reasoning.

When the user uploads images or files:
- inspect and use the uploaded content as part of your answer
- describe what you can directly observe from images before making inferences
- summarize documents clearly and call out important details, risks, and open questions
- if a file appears incomplete, unsupported, or ambiguous, explain what you can and cannot determine
- if an uploaded DOCX or PDF includes a local file path in the message context, call the matching document-reading tool first before answering in detail
- use the available document-reading tools whenever a real accessible local file path is present for DOCX or PDF analysis
- if the message appears to contain pasted raw archive/container content instead of a real attachment or file path, say that explicitly before doing anything else
- treat signatures like \`PK\`, \`word/document.xml\`, \`word/styles.xml\`, or \`[Content_Types].xml\` as pasted DOCX/ZIP container data rather than readable document text
- in that case, do not pretend the document was properly uploaded; explain that a real file attachment or accessible path is still needed for reliable extraction

When responding:
  - be concise by default, but go deeper when the user asks
  - prefer clear structure when summarizing long content
  - state uncertainty instead of guessing
  - if the user asks for a format, follow it closely`,
  model: customOpenAIDefaultModel,
  tools: { readDocxTool, readPdfTool },
  hooks: {
    beforeToolCall: ({ toolName, input }) => {
      console.info(`[general-agent] beforeToolCall: ${toolName}`, input);
    },
    afterToolCall: ({ toolName, output, error }) => {
      console.info(`[general-agent] afterToolCall: ${toolName}`, {
        error: error ? (error instanceof Error ? error.message : String(error)) : null,
        hasOutput: output != null,
      });
    },
  },
  memory: new Memory(),
});
