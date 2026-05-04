import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  Dimensions,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Svg, {Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {GradientBackground} from '@/components/GradientBackground';
import {MicIcon} from '@/components/TabIcons';
import {generateStream, stopGeneration} from '@/native/LLMBridge';
import {startListening, stopListening} from '@/native/NativeOlixSpeech';
import {speak, stopSpeaking} from '@/native/NativeOlixTTS';
import {formatGemmaPrompt} from '@/utils/formatPrompt';
import {colors} from '@/theme/colors';

// ─── Sine wave helpers ────────────────────────────────────────────────────────

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const WAVE_HEIGHT = 160;
const WAVE_CONFIGS = [
  {amp: 30, freq: 1.8, phase: 0, opacity: 0.9, gradientId: 'waveA'},
  {amp: 20, freq: 2.2, phase: Math.PI / 3, opacity: 0.6, gradientId: 'waveB'},
  {amp: 15, freq: 1.5, phase: (2 * Math.PI) / 3, opacity: 0.4, gradientId: 'waveC'},
];

function buildPath(amp: number, freq: number, phase: number, w: number, h: number): string {
  const cy = h / 2;
  return Array.from({length: 101}, (_, i) => {
    const x = (i / 100) * w;
    const y = cy + amp * Math.sin(freq * (i / 100) * 2 * Math.PI + phase);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// ─── Wave component ───────────────────────────────────────────────────────────

function WaveAnimation({active}: {active: boolean}): React.JSX.Element {
  const phaseRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame>>();
  const [paths, setPaths] = useState(() =>
    WAVE_CONFIGS.map(c => buildPath(c.amp, c.freq, c.phase, SCREEN_WIDTH, WAVE_HEIGHT)),
  );

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      phaseRef.current += 0.06;
      setPaths(
        WAVE_CONFIGS.map(c =>
          buildPath(c.amp, c.freq, c.phase + phaseRef.current, SCREEN_WIDTH, WAVE_HEIGHT),
        ),
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <Svg width={SCREEN_WIDTH} height={WAVE_HEIGHT}>
      <Defs>
        <LinearGradient id="waveA" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.waveA} stopOpacity="1" />
          <Stop offset="0.5" stopColor={colors.waveB} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.waveC} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="waveB" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.waveB} stopOpacity="1" />
          <Stop offset="0.5" stopColor={colors.waveC} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.waveA} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="waveC" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.waveC} stopOpacity="1" />
          <Stop offset="0.5" stopColor={colors.waveA} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.waveB} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {WAVE_CONFIGS.map((cfg, i) => (
        <Path
          key={cfg.gradientId}
          d={paths[i]}
          stroke={`url(#${cfg.gradientId})`}
          strokeWidth={active ? 2.5 : 1.5}
          strokeOpacity={cfg.opacity}
          fill="none"
        />
      ))}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Tap the mic to start',
  listening: "I'm listening…",
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export function VoiceScreen(): React.JSX.Element {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const isActiveRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      return () => {
        isActiveRef.current = false;
        stopListening();
        stopGeneration();
        stopSpeaking();
      };
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        isActiveRef.current = false;
        stopListening();
        stopGeneration();
        stopSpeaking();
        setVoiceState('idle');
      } else {
        isActiveRef.current = true;
      }
    });
    return () => sub.remove();
  }, []);

  async function handleMicPress(): Promise<void> {
    if (voiceState === 'listening') {
      stopListening();
      setVoiceState('idle');
      return;
    }
    if (voiceState !== 'idle') return;

    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {title: 'Microphone access', message: 'akhr needs the microphone to hear you.', buttonPositive: 'Allow'},
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Permission needed', 'Please allow microphone access in Settings to use voice mode.');
      return;
    }

    setVoiceState('listening');
    setTranscript('');
    setResponse('');

    try {
      const text = await startListening();
      if (!isActiveRef.current) return;
      setTranscript(text);
      if (!text.trim()) {
        setVoiceState('idle');
        return;
      }

      setVoiceState('thinking');
      const prompt = formatGemmaPrompt([{role: 'user', content: text}], true);
      let accumulated = '';

      // ── Buffer & flush ──────────────────────────────────────────────────────
      // Collect tokens into a buffer and flush to Kokoro on sentence boundaries.
      // While one chunk is being spoken, generation continues filling the next.
      let buffer = '';
      const pendingChunks: string[] = [];
      const draining = {value: false};

      async function drainSpeaker(): Promise<void> {
        if (draining.value) return;
        draining.value = true;
        while (pendingChunks.length > 0 && isActiveRef.current) {
          setVoiceState('speaking');
          await speak(pendingChunks.shift()!);
        }
        draining.value = false;
      }

      function flushBuffer(): void {
        const chunk = buffer.trim();
        buffer = '';
        if (chunk && isActiveRef.current) {
          pendingChunks.push(chunk);
          void drainSpeaker();
        }
      }

      await generateStream(prompt, token => {
        if (!isActiveRef.current) return;
        accumulated += token;
        buffer += token;
        setResponse(accumulated);
        if (/[.!?,]/.test(token)) flushBuffer();
      });

      // Flush any trailing text that didn't end with punctuation
      flushBuffer();

      // Wait for the speaker queue to empty (30 s hard timeout prevents permanent lock)
      const deadline = Date.now() + 30_000;
      while ((pendingChunks.length > 0 || draining.value) && isActiveRef.current && Date.now() < deadline) {
        await new Promise<void>(r => setTimeout(r, 100));
      }
    } catch {
      setVoiceState('idle');
    } finally {
      setVoiceState('idle');
    }
  }

  const isActive = voiceState !== 'idle';

  return (
    <View style={styles.screen}>
      <GradientBackground gradientId="voiceBg" startColor="#F8F6FF" endColor="#DDD6FE" />
      {/* Header */}
      <Text style={styles.header}>{'Speaking to akhr'}</Text>

      {/* State label */}
      <Text style={styles.stateLabel}>{STATE_LABEL[voiceState]}</Text>

      {/* Sine wave */}
      <View style={styles.waveContainer}>
        <WaveAnimation active={isActive} />
      </View>

      {/* Response text */}
      {response ? (
        <ScrollView style={styles.responseScroll} contentContainerStyle={styles.responseContent}>
          <Text style={styles.responseText}>{response}</Text>
        </ScrollView>
      ) : null}

      {/* Transcript */}
      {transcript ? (
        <Text style={styles.transcriptText} numberOfLines={2}>
          {transcript}
        </Text>
      ) : null}

      {/* Mic button */}
      <TouchableOpacity
        style={[styles.micButton, voiceState === 'listening' && styles.micButtonActive]}
        onPress={() => void handleMicPress()}
        activeOpacity={0.8}>
        <MicIcon color="#fff" size={28} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  stateLabel: {
    color: colors.purpleLight,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  waveContainer: {
    width: SCREEN_WIDTH,
    height: WAVE_HEIGHT,
    marginHorizontal: -24,
  },
  responseScroll: {
    maxHeight: 100,
    width: '100%',
    marginTop: 16,
  },
  responseContent: {
    alignItems: 'center',
  },
  responseText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  transcriptText: {
    color: colors.purpleDim,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    shadowColor: colors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: colors.danger,
  },
});
