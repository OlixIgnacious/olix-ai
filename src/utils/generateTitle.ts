import {generateStream} from '@/native';
import {formatGemmaPrompt} from './formatPrompt';

export async function generateConversationTitle(
  userMessage: string,
  assistantResponse: string,
): Promise<string> {
  const userText = userMessage.replace(/^\[(image|doc)[^\]]*\]\n?/i, '').trim().slice(0, 150);
  const assistantText = assistantResponse.slice(0, 150);

  const prompt = formatGemmaPrompt([
    {
      role: 'user',
      content: `Write a short title (4 words max, no quotes, no punctuation) for this conversation:\nUser: ${userText}\nAssistant: ${assistantText}\nTitle:`,
    },
  ]);

  let title = '';
  try {
    await generateStream(prompt, token => {
      title += token;
    });
  } catch (_) {
    // Fall back to user text on any failure
  }

  const cleaned = title.trim().replace(/["'.\n]/g, '').slice(0, 50);
  return cleaned || userText.slice(0, 40) || 'New Chat';
}
