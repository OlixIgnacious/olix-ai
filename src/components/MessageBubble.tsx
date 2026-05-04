import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {BoxiIcon} from '@/components/TabIcons';
import {colors} from '@/theme/colors';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

// ─── User bubble content ──────────────────────────────────────────────────────

const IMAGE_RE = /^\[image:\s*([^\]]+)\]\n?/;
const DOC_RE = /^\[doc:\s*([^\]]+)\]\n?/;

function UserBubbleContent({content}: {content: string}): React.JSX.Element {
  const imgMatch = content.match(IMAGE_RE);
  const docMatch = !imgMatch ? content.match(DOC_RE) : null;
  const match = imgMatch ?? docMatch;

  if (match) {
    const filename = match[1]?.trim() ?? '';
    const label = imgMatch ? `🖼  ${filename}` : `📄  ${filename}`;
    const rest = content.slice(match[0].length).trim();
    return (
      <>
        <View style={styles.attachChip}>
          <Text style={styles.attachChipText} numberOfLines={1}>{label}</Text>
        </View>
        {rest ? <Text style={[styles.textUser, styles.attachRest]}>{rest}</Text> : null}
      </>
    );
  }
  return <Text style={styles.textUser}>{content}</Text>;
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

export function MessageBubble({role, content, isStreaming = false}: Props): React.JSX.Element {
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <BoxiIcon size={22} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isUser ? (
          <UserBubbleContent content={content} />
        ) : isStreaming && !content ? (
          <ActivityIndicator size="small" color={colors.purpleDim} style={styles.thinkingSpinner} />
        ) : (
          <>
            <Markdown style={markdownStyles}>{content}</Markdown>
            {isStreaming ? <Text style={styles.cursor}>{' ▋'}</Text> : null}
          </>
        )}
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
    alignItems: 'flex-end',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  bubble: {
    borderRadius: 20,
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.assistantBubble,
    borderBottomLeftRadius: 6,
  },
  textUser: {
    color: colors.userBubbleText,
    fontSize: 15,
    lineHeight: 21,
  },
  attachChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  attachChipText: {
    color: colors.userBubbleText,
    fontSize: 12,
    fontWeight: '500',
  },
  attachRest: {
    marginTop: 4,
  },
  cursor: {
    color: colors.textSecondary,
  },
  thinkingSpinner: {
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.assistantBubbleText,
    fontSize: 15,
    lineHeight: 21,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  paragraph: {
    marginVertical: 2,
  },
  code_inline: {
    backgroundColor: '#E5E2DC',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
  },
  fence: {
    backgroundColor: '#E5E2DC',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 10,
    marginVertical: 6,
  },
});
