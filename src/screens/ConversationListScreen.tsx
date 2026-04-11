/**
 * ConversationListScreen — lists all past conversations, newest first.
 *
 * - Reloads on every focus so it stays current after returning from ChatScreen.
 * - "New chat" button in the header creates a conversation then navigates to it.
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

type Nav = NativeStackNavigationProp<RootStackParamList, 'ConversationList'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ConversationListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // ── Reload on every focus ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setConversations(db.conversations.findAll());
    }, []),
  );

  // ── Header: New chat button ───────────────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => <NewChatButton onPress={handleNewChat} />,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  // ── Empty state ───────────────────────────────────────────────────────────

  if (conversations.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{'No conversations yet'}</Text>
        <Text style={styles.emptySubtitle}>{'Start chatting with Olix'}</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={handleNewChat}>
          <Text style={styles.emptyButtonText}>{'New chat'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────

  return (
    <FlatList
      data={conversations}
      keyExtractor={item => item.id}
      renderItem={({item}) => (
        <ConversationRow
          conversation={item}
          onPress={() => navigation.navigate('Chat', {conversationId: item.id})}
          onLongPress={() => handleDelete(item.id, item.title)}
        />
      )}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.list}
    />
  );
}

// ─── Header button ────────────────────────────────────────────────────────────

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
      <Text style={styles.rowTitle} numberOfLines={1}>
        {conversation.title}
      </Text>
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
  list: {
    flexGrow: 1,
  },
  row: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: {
    color: '#1A1A1A',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 12,
  },
  rowDate: {
    color: '#999',
    fontSize: 12,
    flexShrink: 0,
  },
  separator: {
    backgroundColor: '#F0F0F0',
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    color: '#1A1A1A',
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  emptyButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerBtn: {
    color: '#007AFF',
    fontSize: 16,
  },
});
