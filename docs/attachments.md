# Attachment Support

This starter is designed to feel like a chat-first file upload workflow for OpenAI-compatible endpoints.

## Behavior summary

- Images are sent as native multimodal inputs for vision-capable models.
- Text-like files are inlined into the prompt automatically when the upstream OpenAI-compatible path does not support those file types natively.
- PDFs are passed through as file attachments when supported by the provider path.
- Office documents and generic binary files are not fully supported yet and usually need a parser or tool workflow.

## Support matrix

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

## Text attachment fallback limits

To keep prompts safe and predictable, text-like attachments are capped before being inlined:

- `CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_BYTES`
  Default: `256000`
- `CUSTOM_OPENAI_TEXT_ATTACHMENT_MAX_CHARS`
  Default: `20000`

If a file exceeds the byte limit, the gateway inserts a note explaining that the attachment was omitted from inline fallback.

## Related docs

- [Model capabilities](model-capabilities.md)
- [PDF skills](pdf-skills.md)
- [DOCX skills](docx-skills.md)
