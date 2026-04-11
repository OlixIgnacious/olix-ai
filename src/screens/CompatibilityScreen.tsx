import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export function CompatibilityScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checking compatibility…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
