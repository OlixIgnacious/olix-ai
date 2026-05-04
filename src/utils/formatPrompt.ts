/**
 * Formats a conversation history into the Gemma instruction-tuned prompt format.
 *
 * Gemma uses start_of_turn / end_of_turn delimiters:
 *   <start_of_turn>user
 *   {message}<end_of_turn>
 *   <start_of_turn>model
 *   {response}<end_of_turn>
 *   ...
 *   <start_of_turn>model
 *
 * The trailing open model turn signals the model to generate the next response.
 *
 * Reference: https://ai.google.dev/gemma/docs/formatting
 */

export type PromptMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPT =
  'You are akhr, a private on-device AI assistant made by Olix Studios, ' +
  'powered by the Gemma 4 model running entirely on this device. ' +
  'When asked about your name, who made you, or what powers you, answer with ' +
  'these facts concisely. For all other topics, be a helpful assistant.';

const VOICE_SYSTEM_PROMPT =
  'You are akhr, a private on-device AI assistant made by Olix Studios, ' +
  'powered by the Gemma 4 model running entirely on this device. ' +
  'You are in voice mode. Respond in short, natural spoken sentences. ' +
  'Never use markdown, bullet points, numbered lists, or special symbols. ' +
  'Write as if speaking aloud. Keep answers concise and conversational.';

export function formatGemmaPrompt(messages: PromptMessage[], voiceMode = false): string {
  const systemPrompt = voiceMode ? VOICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  let prompt = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const turn = msg.role === 'user' ? 'user' : 'model';
    const content =
      i === 0 && msg.role === 'user'
        ? `${systemPrompt}\n\n${msg.content}`
        : msg.content;
    prompt += `<start_of_turn>${turn}\n${content}<end_of_turn>\n`;
  }

  // Open model turn — instructs the model to generate the reply.
  prompt += '<start_of_turn>model\n';
  return prompt;
}
