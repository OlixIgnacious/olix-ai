/**
 * DownloadScreen — downloads the Gemma model with a resumable progress UI.
 *
 * Flow:
 *   1. On mount, call ModelDownloader.ensureModel() — returns immediately if
 *      the model is already on disk, otherwise streams download progress.
 *   2. After download, load the model into the native LLM bridge.
 *   3. Navigate to ConversationList when ready.
 *   4. On error, show an inline retry button.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {ModelDownloader} from '@/services/ModelDownloader';
import type {DownloadProgress} from '@/services/ModelDownloader';
import {loadModel} from '@/native';
import {logger} from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'Download'>;

type Phase =
  | {kind: 'checking'}
  | {kind: 'downloading'; progress: DownloadProgress}
  | {kind: 'loading'}
  | {kind: 'error'; message: string};

export function DownloadScreen({navigation}: Props): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({kind: 'checking'});
  const downloaderRef = useRef<ModelDownloader | null>(null);

  const run = useCallback(async (): Promise<void> => {
    setPhase({kind: 'checking'});

    const downloader = new ModelDownloader(progress => {
      setPhase({kind: 'downloading', progress});
    });
    downloaderRef.current = downloader;

    let modelPath: string;
    try {
      modelPath = await downloader.ensureModel();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      logger.error('DownloadScreen: download error', err);
      setPhase({kind: 'error', message});
      return;
    }

    setPhase({kind: 'loading'});
    try {
      await loadModel(modelPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model';
      logger.error('DownloadScreen: loadModel error', err);
      setPhase({kind: 'error', message});
      return;
    }

    navigation.replace('ConversationList');
  }, [navigation]);

  useEffect(() => {
    void run();
    return () => {
      downloaderRef.current?.cancel();
    };
  }, [run]);

  return (
    <View style={styles.container}>
      {phase.kind === 'checking' && <CheckingView />}
      {phase.kind === 'downloading' && <DownloadingView progress={phase.progress} />}
      {phase.kind === 'loading' && <LoadingView />}
      {phase.kind === 'error' && (
        <ErrorView
          message={phase.message}
          onRetry={() => {
            void run();
          }}
        />
      )}
    </View>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function CheckingView(): React.JSX.Element {
  return (
    <>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.label}>{'Preparing model…'}</Text>
    </>
  );
}

type DownloadingViewProps = {progress: DownloadProgress};

function DownloadingView({progress}: DownloadingViewProps): React.JSX.Element {
  const {percent, received, total, etaSeconds} = progress;

  const receivedMB = (received / 1024 / 1024).toFixed(1);
  const totalMB = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?';
  const etaLabel = etaSeconds > 0 ? formatEta(etaSeconds) : '';

  return (
    <>
      <Text style={styles.title}>{'Downloading Gemma model'}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, {width: `${percent}%`}]} />
      </View>
      <Text style={styles.percent}>{`${percent}%`}</Text>
      <Text style={styles.detail}>{`${receivedMB} MB / ${totalMB} MB`}</Text>
      {etaLabel ? <Text style={styles.detail}>{`ETA ${etaLabel}`}</Text> : null}
    </>
  );
}

function LoadingView(): React.JSX.Element {
  return (
    <>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.label}>{'Loading model into memory…'}</Text>
      <Text style={styles.detail}>{'This may take a moment on first run.'}</Text>
    </>
  );
}

type ErrorViewProps = {message: string; onRetry: () => void};

function ErrorView({message, onRetry}: ErrorViewProps): React.JSX.Element {
  return (
    <>
      <Text style={styles.errorTitle}>{'Download failed'}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryLabel}>{'Retry'}</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEta(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: '#111',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  label: {
    color: '#555',
    fontSize: 15,
  },
  detail: {
    color: '#888',
    fontSize: 13,
  },
  percent: {
    color: '#111',
    fontSize: 28,
    fontWeight: '700',
  },
  barTrack: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    backgroundColor: '#000',
    borderRadius: 4,
    height: 8,
  },
  errorTitle: {
    color: '#C00',
    fontSize: 17,
    fontWeight: '600',
  },
  errorMessage: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
