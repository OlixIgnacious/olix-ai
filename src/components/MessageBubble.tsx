/**
 * MessageBubble — renders a single chat message.
 *
 * User messages appear on the right in a dark bubble.
 * Assistant messages appear on the left in a light bubble.
 * A blinking cursor (▋) is shown on the active streaming bubble.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  /** True only on the in-progress assistant bubble while tokens are streaming. */
  isStreaming?: boolean;
};

export function MessageBubble({role, content, isStreaming = false}: Props): React.JSX.Element {
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {content}
          {isStreaming ? <Text style={styles.cursor}>{' ▋'}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 12,
    marginVertical: 4,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#1A1A1A',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAssistant: {
    color: '#1A1A1A',
  },
  cursor: {
    color: '#666',
  },
});
