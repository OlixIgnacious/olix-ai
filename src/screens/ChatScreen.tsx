import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({route}: Props): React.JSX.Element {
  const {conversationId} = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{'Chat'}</Text>
      <Text style={styles.subtitle}>{`Conversation: ${conversationId}`}</Text>
      <Text style={styles.subtitle}>{'(placeholder — Phase 6)'}</Text>
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
