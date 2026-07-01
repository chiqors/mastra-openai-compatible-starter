# Voice Setup

This starter supports two speech input paths in Mastra Studio:

1. Browser speech recognition fallback
2. Mastra voice provider on the agent

## Current behavior

The Weather Agent currently does not define a `voice` provider in [weather-agent.ts](/Users/administrator/Documents/Labs/my-mastra/src/mastra/agents/weather-agent.ts), so Studio falls back to browser speech recognition.

That means:

- If the browser supports `SpeechRecognition` or `webkitSpeechRecognition`, Studio will try browser speech input.
- If the browser path fails, Studio now shows the error inline in the composer.
- Different browsers may behave differently even if they are Chromium-based.

## When Mastra uses browser fallback

Mastra Studio uses browser speech recognition when the agent does not expose a usable voice provider.

In the Mastra React client, the decision is:

- if the agent has voice speakers available, use the Mastra voice path
- otherwise, use browser speech recognition

So if you do not configure `voice` on the agent, browser fallback is expected.

## How to enable a Mastra voice provider

To switch the agent from browser fallback to a Mastra-managed voice provider, add a `voice` field to the agent config.

Example with OpenAI voice:

```ts
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `...`,
  model: customOpenAIDefaultModel,
  voice: new OpenAIVoice(),
  tools: { weatherTool },
  memory: new Memory(),
});
```

This requires:

- installing `@mastra/voice-openai`
- setting `OPENAI_API_KEY`

By default, `OpenAIVoice` uses:

- speech output: `tts-1`
- transcription input: `whisper-1`

## More explicit voice configuration

If you want to configure the speech and transcription models directly:

```ts
voice: new OpenAIVoice({
  speechModel: {
    name: 'tts-1',
    apiKey: process.env.OPENAI_API_KEY,
  },
  listeningModel: {
    name: 'whisper-1',
    apiKey: process.env.OPENAI_API_KEY,
  },
  speaker: 'alloy',
}),
```

## Using different input/output providers

If you want more control, Mastra supports a split voice configuration through `CompositeVoice`.

Example shape:

```ts
import { CompositeVoice, AISDKSpeech, AISDKTranscription } from '@mastra/core/voice';
import { openai } from '@ai-sdk/openai';

voice: new CompositeVoice({
  output: new AISDKSpeech(openai.speech('tts-1'), { voice: 'alloy' }),
  input: new AISDKTranscription(openai.transcription('whisper-1')),
}),
```

This is useful when:

- input transcription and output speech should use different providers
- you want more explicit control than `OpenAIVoice()`

## Do you need to change Mastra source code?

No, not to enable a voice provider.

To use a Mastra voice provider, the required changes are in your app code:

- add `voice` to the agent config
- install the provider package
- configure the needed API keys

The Mastra fork changes in this project were only for:

- improving browser fallback behavior
- surfacing browser speech errors inline in Studio

They are not required just to enable a provider-based voice path.

## Practical recommendation

Use browser fallback only as a convenience feature.

If you want reliable voice input across Chrome forks and non-Chrome browsers, prefer a Mastra voice provider on the agent. That avoids dependence on the browser's `SpeechRecognition` implementation and backend service availability.
