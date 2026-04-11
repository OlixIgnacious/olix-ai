import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {runCompatibilityCheck} from '@/services/compatibility';
import {logger} from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'Compatibility'>;

export function CompatibilityScreen({navigation}: Props): React.JSX.Element {
  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      try {
        const result = await runCompatibilityCheck();
        if (cancelled) {
          return;
        }
        if (result.compatible) {
          navigation.replace('Download');
        } else {
          navigation.replace('Blocked', {reasons: result.reasons});
        }
      } catch (err) {
        logger.error('Compatibility check threw unexpectedly', err);
        if (!cancelled) {
          // Surface as a single generic reason rather than crashing
          navigation.replace('Blocked', {
            reasons: ['Unable to verify device compatibility. Please restart the app.'],
          });
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.label}>{'Checking device compatibility…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    color: '#555',
    fontSize: 15,
  },
});
