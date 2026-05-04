/**
 * ConversationListScreen — lists all past conversations, newest first.
 *
 * - Reloads on every focus so it stays current after returning from ChatScreen.
 * - "New chat" button in the header creates a conversation then navigates to it.
 * - Settings gear in the header navigates to SettingsScreen.
 * - Long-press any row to delete with confirmation.
 * - Empty state with a CTA when there are no conversations.
 */

import React, {useCallback, useLayoutEffect, useState} from 'react';
import {Alert, FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {db} from '@/db';
import type {Conversation} from '@/db';
import {colors} from '@/theme/colors';
import {GradientBackground} from '@/components/GradientBackground';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanTitle(raw: string): string {
  const stripped = raw.replace(/^\[(image|doc):\s*[^\]]*\]?\s*/i, '').trim();
  return stripped || raw;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ConversationListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useFocusEffect(
    useCallback(() => {
      setConversations(db.conversations.findAll());
    }, []),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => <NewChatButton onPress={handleNewChat} />,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  function handleNewChat(): void {
    const conv = db.conversations.create('New Chat');
    navigation.navigate('Chat', {conversationId: conv.id});
  }

  function handleDelete(id: string, title: string): void {
    Alert.alert(`Delete "${title}"?`, 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          db.conversations.delete(id);
          setConversations(prev => prev.filter(c => c.id !== id));
        },
      },
    ]);
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.empty}>
        <GradientBackground gradientId="chatListEmptyBg" startColor="#F8F6FF" endColor="#DDD6FE" />
        <Text style={styles.emptyTitle}>{'No conversations yet'}</Text>
        <Text style={styles.emptySubtitle}>{'Start chatting with akhr'}</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={handleNewChat}>
          <Text style={styles.emptyButtonText}>{'New chat'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GradientBackground gradientId="chatListBg" startColor="#F8F6FF" endColor="#DDD6FE" />
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <ConversationRow
            conversation={item}
            onPress={() => navigation.navigate('Chat', {conversationId: item.id})}
            onLongPress={() => handleDelete(item.id, cleanTitle(item.title))}
          />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        style={styles.screen}
      />
    </View>
  );
}

// ─── Header buttons ───────────────────────────────────────────────────────────

function SettingsButton({onPress}: {onPress: () => void}): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8}>
      <Text style={styles.headerBtn}>{'⚙'}</Text>
    </TouchableOpacity>
  );
}

function NewChatButton({onPress}: {onPress: () => void}): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8}>
      <Text style={styles.headerBtn}>{'New chat'}</Text>
    </TouchableOpacity>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

type RowProps = {
  conversation: Conversation;
  onPress: () => void;
  onLongPress: () => void;
};

function ConversationRow({conversation, onPress, onLongPress}: RowProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {cleanTitle(conversation.title)}
        </Text>
        {conversation.preview ? (
          <Text style={styles.rowPreview} numberOfLines={2}>
            {conversation.preview}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowDate}>{formatDate(conversation.updatedAt)}</Text>
    </TouchableOpacity>
  );
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }
  return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lavender,
  },
  screen: {
    backgroundColor: 'transparent',
  },
  list: {
    flexGrow: 1,
  },
  row: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBody: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  rowPreview: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  rowDate: {
    color: colors.textSecondary,
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  separator: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  emptyButton: {
    backgroundColor: colors.purple,
    borderRadius: 20,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerBtn: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
    paddingHorizontal: 4,
  },
});
