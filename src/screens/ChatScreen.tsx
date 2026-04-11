/**
 * ChatScreen — the core chat interface.
 *
 * Responsibilities:
 *   - Load and display persisted messages from SQLite on mount.
 *   - Send user input to the native LLM bridge and stream the response token
 *     by token into a live bubble.
 *   - Persist both the user message and the final (or partial) assistant
 *     response to SQLite.
 *   - Show an abort button during generation; tapping it saves the partial
 *     response and clears the streaming state.
 *   - Auto-title the conversation from the first user message.
 *   - Stop generation when the app is backgrounded.
 *   - Auto-scroll to the latest message as tokens arrive.
 *
 * Abort design note:
 *   `stopGeneration()` suppresses further token events from the native side.
 *   After it is called, the in-flight `generateStream` Promise never settles
 *   (by design — see LLMBridge). All cleanup is therefore done directly in
 *   `handleAbort` rather than relying on the Promise's finally block.
 *   `isGeneratingRef` guards against any residual state updates from the
 *   dangling async function.
 */

import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {db} from '@/db';
import type {Message} from '@/db';
import {generateStream, stopGeneration} from '@/native';
import {logger} from '@/utils/logger';
import {formatGemmaPrompt} from '@/utils/formatPrompt';
import {MessageBubble} from '@/components/MessageBubble';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// ─── Streaming item type ──────────────────────────────────────────────────────

type StreamingItem = {
  id: '__streaming__';
  role: 'assistant';
  content: string;
  isStreaming: true;
};

type ListItem = Message | StreamingItem;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ChatScreen({route, navigation}: Props): React.JSX.Element {
  const {conversationId} = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState('');

  const flatListRef = useRef<FlatList<ListItem>>(null);
  // Refs for coordination between handleSend and handleAbort without stale closures
  const isGeneratingRef = useRef(false);
  const accumulatedRef = useRef('');

  // ── Load messages on mount ──────────────────────────────────────────────
  useEffect(() => {
    setMessages(db.messages.findByConversation(conversationId));
  }, [conversationId]);

  // ── Sync header title with conversation title ───────────────────────────
  useLayoutEffect(() => {
    const conv = db.conversations.findById(conversationId);
    if (conv) {
      navigation.setOptions({title: conv.title === 'New Chat' ? '' : conv.title});
    }
  }, [conversationId, navigation]);

  // ── Stop generation when app is backgrounded ────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && isGeneratingRef.current) {
        handleAbort();
      }
    });
    return () => sub.remove();
    // handleAbort is stable (only uses refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({animated: true});
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (!text || isGeneratingRef.current) {
      return;
    }

    setInput('');

    // 1. Persist user message
    const userMsg = db.messages.create(conversationId, 'user', text);
    setMessages(prev => [...prev, userMsg]);

    // 2. Load full history (includes the message we just saved)
    const history = db.messages.findByConversation(conversationId);

    // 3. Auto-title on first message
    if (history.length === 1) {
      const title = text.length > 40 ? `${text.slice(0, 40)}\u2026` : text;
      db.conversations.updateTitle(conversationId, title);
      navigation.setOptions({title});
    }

    // 4. Bump conversation to top of list
    db.conversations.touch(conversationId);

    // 5. Build Gemma-formatted prompt
    const prompt = formatGemmaPrompt(history.map(m => ({role: m.role, content: m.content})));

    // 6. Begin streaming
    setIsGenerating(true);
    isGeneratingRef.current = true;
    accumulatedRef.current = '';
    setStreamingContent('');

    try {
      await generateStream(prompt, token => {
        if (!isGeneratingRef.current) {
          return; // aborted — discard late tokens
        }
        accumulatedRef.current += token;
        setStreamingContent(accumulatedRef.current);
      });

      // Reached only on natural completion (not after stopGeneration)
      if (accumulatedRef.current) {
        const assistantMsg = db.messages.create(
          conversationId,
          'assistant',
          accumulatedRef.current,
        );
        setMessages(prev => [...prev, assistantMsg]);
        db.conversations.touch(conversationId);
      }
    } catch (err) {
      // Reached only on native error (not after stopGeneration)
      logger.error('ChatScreen: generation error', err);
      if (accumulatedRef.current) {
        const partial = db.messages.create(conversationId, 'assistant', accumulatedRef.current);
        setMessages(prev => [...prev, partial]);
        db.conversations.touch(conversationId);
      }
      Alert.alert('Generation failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      // Reached only on natural completion or native error — NOT after abort
      setStreamingContent('');
      setIsGenerating(false);
      isGeneratingRef.current = false;
      scrollToBottom();
    }
  }, [input, conversationId, navigation, scrollToBottom]);

  // ── Abort ───────────────────────────────────────────────────────────────
  // Defined outside useCallback so AppState handler can reference it via the
  // closure without stale state. Uses only refs and setters — always stable.
  function handleAbort(): void {
    stopGeneration(); // suppresses further token events; generateStream Promise hangs forever
    isGeneratingRef.current = false;

    if (accumulatedRef.current) {
      const partial = db.messages.create(conversationId, 'assistant', accumulatedRef.current);
      setMessages(prev => [...prev, partial]);
      db.conversations.touch(conversationId);
      accumulatedRef.current = '';
    }

    setStreamingContent('');
    setIsGenerating(false);
    scrollToBottom();
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const listItems: ListItem[] = streamingContent
    ? [
        ...messages,
        {id: '__streaming__', role: 'assistant', content: streamingContent, isStreaming: true},
      ]
    : messages;

  const canSend = input.trim().length > 0 && !isGenerating;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}>
      <FlatList<ListItem>
        ref={flatListRef}
        data={listItems}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <MessageBubble
            role={item.role}
            content={item.content}
            isStreaming={'isStreaming' in item && item.isStreaming}
          />
        )}
        contentContainerStyle={styles.listContent}
        onLayout={scrollToBottom}
        onContentSizeChange={scrollToBottom}
        keyboardDismissMode="interactive"
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={'Message Olix\u2026'}
          placeholderTextColor={'#999'}
          multiline
          editable={!isGenerating}
          returnKeyType={'send'}
          blurOnSubmit={false}
          onSubmitEditing={() => {
            void handleSend();
          }}
        />

        {isGenerating ? (
          <TouchableOpacity style={[styles.sendButton, styles.abortButton]} onPress={handleAbort}>
            <Text style={styles.sendIcon}>{'■'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={() => {
              void handleSend();
            }}
            disabled={!canSend}>
            <Text style={styles.sendIcon}>{'↑'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputRow: {
    alignItems: 'flex-end',
    borderTopColor: '#E8E8E8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    color: '#1A1A1A',
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: {
    backgroundColor: '#C8C8C8',
  },
  abortButton: {
    backgroundColor: '#CC0000',
  },
  sendIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
});
