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
  'You are boxi, a private AI assistant made by Olix Studios, running fully on this device. ' +
  'Be warm, direct, and conversational. Vary your sentence structure. ' +
  'Never sound like a list unless the user asks for one. Say more with less. ' +
  'If asked about your name, who made you, or what model you use, answer those facts briefly then move on.';

const VOICE_SYSTEM_PROMPT =
  'You are boxi, a private AI assistant made by Olix Studios, running fully on this device. ' +
  'You are in voice mode. Reply in 1 to 2 sentences only — never more. ' +
  'Speak naturally, no lists, no markdown, no special symbols. ' +
  'Be warm and direct.';

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
