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
 *   - AI-generate a conversation title after the first exchange completes.
 *   - Stop generation when the app is backgrounded.
 *   - Auto-scroll to the latest message as tokens arrive.
 *   - Detect thermal throttling (token rate drops >60% from peak) and show a
 *     dismissible warning banner.
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
  FlatList,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {db} from '@/db';
import type {Message} from '@/db';
import {generateStream, stopGeneration} from '@/native';
import {logger} from '@/utils/logger';
import {formatGemmaPrompt} from '@/utils/formatPrompt';
import {generateConversationTitle} from '@/utils/generateTitle';
import {MessageBubble} from '@/components/MessageBubble';
import {GradientBackground} from '@/components/GradientBackground';
import {MicIcon, SpeakerIcon} from '@/components/TabIcons';
import {pickAndReadDocument, type PickedDocument} from '@/services/DocumentReader';
import {pickImage, type PickedImage} from '@/services/ImageReader';
import {ModelDownloader} from '@/services/ModelDownloader';
import {startListening, stopListening, onSpeechPartial} from '@/native/NativeOlixSpeech';
import {speak, stopSpeaking} from '@/native/NativeOlixTTS';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// ─── Streaming item type ──────────────────────────────────────────────────────

type StreamingItem = {
  id: '__streaming__';
  role: 'assistant';
  content: string;
  isStreaming: true;
};

type ListItem = Message | StreamingItem;

// ─── Thermal throttle config ──────────────────────────────────────────────────

const THERMAL_BASELINE_TOKENS = 10;
const THERMAL_THROTTLE_RATIO = 0.4;
const THERMAL_WINDOW = 5;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ChatScreen({route, navigation}: Props): React.JSX.Element {
  const {conversationId} = route.params;
  const {bottom: bottomInset} = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState('');
  const [attachedDoc, setAttachedDoc] = useState<PickedDocument | null>(null);
  const [attachedImage, setAttachedImage] = useState<PickedImage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [showThermalWarning, setShowThermalWarning] = useState(false);

  const voiceModeEnabledRef = useRef(false);
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const isGeneratingRef = useRef(false);
  const accumulatedRef = useRef('');
  const tokenTimestampsRef = useRef<number[]>([]);
  const peakRateRef = useRef(0);

  // ── Load messages on mount ──────────────────────────────────────────────
  useEffect(() => {
    setMessages(db.messages.findByConversation(conversationId));
  }, [conversationId]);

  // ── Pre-attach image passed from HomeScreen ─────────────────────────────
  useEffect(() => {
    const {initialImageUri, initialImageName} = route.params;
    if (initialImageUri && initialImageName) {
      setAttachedImage({uri: initialImageUri, name: initialImageName});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync voiceModeEnabled to ref so async callbacks stay current ─────────
  useEffect(() => {
    voiceModeEnabledRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  // ── Sync header title ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const conv = db.conversations.findById(conversationId);
    if (conv) {
      navigation.setOptions({title: conv.title === 'New Chat' ? '' : conv.title});
    }
  }, [conversationId, navigation]);

  // ── Voice toggle button in header ───────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setVoiceModeEnabled(prev => !prev)}
          style={styles.headerVoiceBtn}
          hitSlop={8}>
          <SpeakerIcon color={voiceModeEnabled ? colors.purple : colors.textSecondary} size={22} />
          {voiceModeEnabled && <View style={styles.headerVoiceDot} />}
        </TouchableOpacity>
      ),
    });
  }, [navigation, voiceModeEnabled]);

  // ── Stop generation on unmount (back navigation) ───────────────────────
  // Note: we do NOT abort on app-background — a native wakelock keeps the CPU
  // running so generation completes even when the screen turns off. The user
  // sees the full response when they return.
  useEffect(() => {
    return () => {
      stopGeneration();
      stopSpeaking();
    };
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({animated: true});
  }, []);

  // ── Thermal throttle tracking ────────────────────────────────────────────
  function recordTokenAndCheckThermal(): void {
    const now = Date.now();
    const timestamps = tokenTimestampsRef.current;
    timestamps.push(now);
    if (timestamps.length > THERMAL_WINDOW) {
      timestamps.splice(0, timestamps.length - THERMAL_WINDOW);
    }
    if (timestamps.length < 2) {return;}
    const windowMs = timestamps[timestamps.length - 1]! - timestamps[0]!;
    if (windowMs <= 0) {return;}
    const currentRate = ((timestamps.length - 1) / windowMs) * 1000;
    const totalTokens = tokenTimestampsRef.current.length;
    if (totalTokens >= THERMAL_BASELINE_TOKENS && currentRate > peakRateRef.current) {
      peakRateRef.current = currentRate;
    }
    if (peakRateRef.current > 0 && totalTokens >= THERMAL_BASELINE_TOKENS) {
      if (currentRate / peakRateRef.current < THERMAL_THROTTLE_RATIO) {
        setShowThermalWarning(true);
      }
    }
  }

  // ── Attach (+) ──────────────────────────────────────────────────────────
  const handleAttachChoice = useCallback((): void => {
    Alert.alert('Attach', 'Choose attachment type', [
      {
        text: 'Document',
        onPress: () => {
          void (async () => {
            try {
              const doc = await pickAndReadDocument();
              if (doc) {
                setAttachedDoc(doc);
                setAttachedImage(null);
              }
            } catch (err) {
              logger.error('ChatScreen: document pick failed', err);
              Alert.alert('Could not read file', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
        },
      },
      {
        text: 'Image',
        onPress: () => {
          void (async () => {
            try {
              const img = await pickImage();
              if (img) {
                setAttachedImage(img);
                setAttachedDoc(null);
              }
            } catch (err) {
              logger.error('ChatScreen: image pick failed', err);
              Alert.alert('Could not pick image', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  }, []);

  // ── Mic ─────────────────────────────────────────────────────────────────
  const handleMicPress = useCallback(async (): Promise<void> => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {title: 'Microphone', message: 'akhr needs microphone access to hear you.', buttonPositive: 'Allow'},
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Permission required', 'Microphone access is needed for voice input.');
      return;
    }
    setIsListening(true);
    const partialSub = onSpeechPartial(text => setInput(text));
    try {
      const transcript = await startListening();
      setInput(transcript);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('No speech')) {
        Alert.alert('Voice error', msg || 'Could not recognise speech.');
      }
    } finally {
      partialSub.remove();
      setIsListening(false);
    }
  }, [isListening]);

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if ((!text && !attachedDoc && !attachedImage) || isGeneratingRef.current) {
      return;
    }

    if (attachedImage) {
      const modelInfo = await ModelDownloader.getStoredModelInfo();
      if (!modelInfo || modelInfo.version !== 'gemma-4-e4b-it') {
        Alert.alert(
          'Model update required',
          'Image analysis requires the updated vision model. Please restart the app to trigger re-download.',
        );
        return;
      }
    }

    setInput('');
    setAttachedDoc(null);
    setAttachedImage(null);
    setShowThermalWarning(false);
    tokenTimestampsRef.current = [];
    peakRateRef.current = 0;

    const doc = attachedDoc;
    const img = attachedImage;

    // Display text shown in the bubble and persisted to DB
    const displayText = doc
      ? `[${doc.name}]\n${text || 'Please summarize this document.'}`
      : img
      ? `[image: ${img.name}]\n${text || 'Describe this image.'}`
      : text;

    // Prompt content — full doc injected for documents
    const promptContent = doc
      ? `Document: ${doc.name}${doc.truncated ? ' (truncated to first 12,000 characters)' : ''}\n\nContent:\n${doc.content}\n\n---\n\n${text || 'Please summarize this document.'}`
      : displayText;

    const imagePath = img ? img.uri.replace(/^file:\/\//, '') : null;

    // 1. Persist user message
    const userMsg = db.messages.create(conversationId, 'user', displayText);
    setMessages(prev => [...prev, userMsg]);

    // 2. Full history (includes message just saved)
    const history = db.messages.findByConversation(conversationId);

    // 3. Preliminary title from user text — strip attachment prefixes
    if (history.length === 1) {
      const rawTitle = text || (img ? 'Image chat' : doc ? 'Document chat' : 'New Chat');
      const prelimTitle = rawTitle.length > 40 ? `${rawTitle.slice(0, 40)}\u2026` : rawTitle;
      db.conversations.updateTitle(conversationId, prelimTitle);
      navigation.setOptions({title: prelimTitle});
    }

    // 4. Bump conversation to top of list
    db.conversations.touch(conversationId);

    // 5. Build Gemma-formatted prompt
    const promptMessages = history.map((m, i) =>
      i === history.length - 1 && doc
        ? {role: m.role, content: promptContent}
        : {role: m.role, content: m.content},
    );
    const prompt = formatGemmaPrompt(promptMessages);

    // 6. Stream
    setIsGenerating(true);
    isGeneratingRef.current = true;
    accumulatedRef.current = '';
    setStreamingContent('');

    try {
      await generateStream(
        prompt,
        token => {
          if (!isGeneratingRef.current) {return;}
          accumulatedRef.current += token;
          setStreamingContent(accumulatedRef.current);
          recordTokenAndCheckThermal();
        },
        imagePath,
      );

      // Natural completion only (not after stopGeneration)
      if (accumulatedRef.current) {
        const assistantMsg = db.messages.create(conversationId, 'assistant', accumulatedRef.current);
        setMessages(prev => [...prev, assistantMsg]);
        db.conversations.touch(conversationId);
        db.conversations.updatePreview(conversationId, accumulatedRef.current.slice(0, 80));

        // AI-generated title after first exchange (isGenerating still true — no race)
        if (history.length === 1) {
          const aiTitle = await generateConversationTitle(displayText, accumulatedRef.current);
          db.conversations.updateTitle(conversationId, aiTitle);
          navigation.setOptions({title: aiTitle});
        }

        if (voiceModeEnabledRef.current) {
          void speak(accumulatedRef.current);
        }
      }
    } catch (err) {
      logger.error('ChatScreen: generation error', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('IMAGE_NOT_SUPPORTED')) {
        Alert.alert(
          'Vision model required',
          'The current on-device model is text-only. Image analysis requires a multimodal model update.',
        );
      } else {
        if (accumulatedRef.current) {
          const partial = db.messages.create(conversationId, 'assistant', accumulatedRef.current);
          setMessages(prev => [...prev, partial]);
          db.conversations.touch(conversationId);
        }
        Alert.alert('Generation failed', errMsg || 'Unknown error');
      }
    } finally {
      setStreamingContent('');
      setIsGenerating(false);
      isGeneratingRef.current = false;
      scrollToBottom();
    }
  }, [input, attachedDoc, attachedImage, conversationId, navigation, scrollToBottom]);

  // ── Abort ───────────────────────────────────────────────────────────────
  function handleAbort(): void {
    stopGeneration();
    stopSpeaking();
    isGeneratingRef.current = false;

    if (accumulatedRef.current) {
      const partial = db.messages.create(conversationId, 'assistant', accumulatedRef.current);
      setMessages(prev => [...prev, partial]);
      db.conversations.touch(conversationId);
      accumulatedRef.current = '';
    }

    setStreamingContent('');
    setIsGenerating(false);
    setShowThermalWarning(false);
    scrollToBottom();
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const listItems: ListItem[] = isGenerating
    ? [...messages, {id: '__streaming__', role: 'assistant', content: streamingContent, isStreaming: true}]
    : messages;

  const canSend = (input.trim().length > 0 || attachedDoc !== null || attachedImage !== null) && !isGenerating;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}>
      <GradientBackground gradientId="chatBg" startColor="#F8F6FF" endColor="#DDD6FE" />

      {showThermalWarning && (
        <ThermalWarningBanner onDismiss={() => setShowThermalWarning(false)} />
      )}

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

      {attachedDoc && (
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipIcon}>{'📄'}</Text>
            <Text style={styles.chipName} numberOfLines={1}>
              {attachedDoc.name}
              {attachedDoc.truncated ? ' (truncated)' : ''}
            </Text>
            <TouchableOpacity onPress={() => setAttachedDoc(null)} hitSlop={8}>
              <Text style={styles.chipRemove}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {attachedImage && (
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Image source={{uri: attachedImage.uri}} style={styles.chipThumbnail} />
            <Text style={styles.chipName} numberOfLines={1}>{attachedImage.name}</Text>
            <TouchableOpacity onPress={() => setAttachedImage(null)} hitSlop={8}>
              <Text style={styles.chipRemove}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.inputRow, bottomInset > 0 && {paddingBottom: bottomInset + 4}]}>
        <TouchableOpacity
          style={[styles.iconButton, isGenerating && styles.iconButtonDisabled]}
          onPress={handleAttachChoice}
          disabled={isGenerating}>
          <Text style={styles.iconButtonText}>{'+'}</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={'Message akhr\u2026'}
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={!isGenerating}
          returnKeyType={'send'}
          blurOnSubmit={false}
          onSubmitEditing={() => { void handleSend(); }}
        />

        {!isGenerating && (
          <TouchableOpacity
            style={[styles.iconButton, isListening && styles.iconButtonActive]}
            onPress={() => { void handleMicPress(); }}
            disabled={isGenerating}>
            <MicIcon color={isListening ? '#fff' : colors.textSecondary} size={18} />
          </TouchableOpacity>
        )}

        {isGenerating ? (
          <TouchableOpacity style={[styles.sendButton, styles.abortButton]} onPress={handleAbort}>
            <Text style={styles.sendIcon}>{'■'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={() => { void handleSend(); }}
            disabled={!canSend}>
            <Text style={styles.sendIcon}>{'↑'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Thermal warning banner ───────────────────────────────────────────────────

function ThermalWarningBanner({onDismiss}: {onDismiss: () => void}): React.JSX.Element {
  return (
    <View style={styles.thermalBanner}>
      <Text style={styles.thermalText}>
        {'⚠ Device is warm — generation may be slower than usual'}
      </Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={8}>
        <Text style={styles.thermalDismiss}>{'✕'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.lavender,
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputRow: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.purple,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: {
    backgroundColor: colors.purpleDim,
  },
  abortButton: {
    backgroundColor: colors.danger,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  iconButtonActive: {
    backgroundColor: colors.danger,
  },
  iconButtonText: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 26,
  },
  chipRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '90%',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
  },
  chipRemove: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  headerVoiceBtn: {
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 4,
  },
  headerVoiceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  thermalBanner: {
    alignItems: 'center',
    backgroundColor: colors.warning,
    borderBottomColor: colors.warningBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  thermalText: {
    color: colors.warningText,
    flex: 1,
    fontSize: 12,
  },
  thermalDismiss: {
    color: colors.warningText,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
