import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export function DownloadScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Downloading model…</Text>
      <Text style={styles.subtitle}>{'(placeholder — Phase 4)'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
