/**
 * SettingsScreen — app settings and info.
 *
 * Sections:
 *   - Data: clear all chat history
 *   - Model: installed version (from AsyncStorage)
 *   - About: app version (from react-native-device-info)
 */

import React, {useEffect, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import DeviceInfo from 'react-native-device-info';
import type {RootStackParamList} from '@/navigation/types';
import {db} from '@/db';
import {ModelDownloader} from '@/services/ModelDownloader';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function SettingsScreen({navigation}: Props): React.JSX.Element {
  const [modelVersion, setModelVersion] = useState<string>('—');
  const [appVersion, setAppVersion] = useState<string>('—');

  useEffect(() => {
    void ModelDownloader.getStoredModelInfo().then(info => {
      setModelVersion(info?.version ?? 'Not downloaded');
    });
    setAppVersion(`${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`);
  }, []);

  function handleClearHistory(): void {
    Alert.alert(
      'Clear all chats?',
      'This will permanently delete every conversation and cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            db.conversations.deleteAll();
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── Data ── */}
      <SectionHeader title="Data" />
      <View style={styles.card}>
        <DestructiveRow label="Clear all chats" onPress={handleClearHistory} />
      </View>

      {/* ── Model ── */}
      <SectionHeader title="Model" />
      <View style={styles.card}>
        <InfoRow label="Installed version" value={modelVersion} />
      </View>

      {/* ── About ── */}
      <SectionHeader title="About" />
      <View style={styles.card}>
        <InfoRow label="App version" value={appVersion} />
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({title}: {title: string}): React.JSX.Element {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function InfoRow({label, value}: {label: string; value: string}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function DestructiveRow({label, onPress}: {label: string; onPress: () => void}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.destructiveLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#F2F2F7',
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  sectionHeader: {
    color: '#6D6D72',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    color: '#1C1C1E',
    fontSize: 16,
  },
  rowValue: {
    color: '#8E8E93',
    fontSize: 15,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  destructiveLabel: {
    color: '#FF3B30',
    fontSize: 16,
  },
});
