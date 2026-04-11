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

export function formatGemmaPrompt(messages: PromptMessage[]): string {
  let prompt = '';

  for (const msg of messages) {
    const turn = msg.role === 'user' ? 'user' : 'model';
    prompt += `<start_of_turn>${turn}\n${msg.content}<end_of_turn>\n`;
  }

  // Open model turn — instructs the model to generate the reply.
  prompt += '<start_of_turn>model\n';
  return prompt;
}
