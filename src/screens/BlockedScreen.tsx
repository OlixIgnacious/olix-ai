import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Blocked'>;

export function BlockedScreen({route}: Props): React.JSX.Element {
  const {reasons} = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device not supported</Text>
      <Text style={styles.subtitle}>{'This device cannot run Olix due to the following:'}</Text>
      {reasons.map((reason, i) => (
        <Text key={i} style={styles.reason}>
          {'• '}
          {reason}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  reason: {
    color: '#c0392b',
    fontSize: 15,
    marginTop: 8,
  },
  subtitle: {
    color: '#555',
    fontSize: 15,
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
});
