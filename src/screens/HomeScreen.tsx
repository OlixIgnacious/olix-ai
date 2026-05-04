import React, {useCallback, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {db} from '@/db';
import type {Conversation} from '@/db';
import {colors} from '@/theme/colors';
import {pickImage} from '@/services/ImageReader';
import {GradientBackground} from '@/components/GradientBackground';
import {SearchIcon, NewChatIcon} from '@/components/TabIcons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }
  return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

function cleanTitle(raw: string): string {
  const stripped = raw.replace(/^\[(image|doc):\s*[^\]]*\]?\s*/i, '').trim();
  return stripped || raw;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [recents, setRecents] = useState<Conversation[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecents(db.conversations.findAll().slice(0, 5));
    }, []),
  );

  function handleNewChat(): void {
    const conv = db.conversations.create('New Chat');
    navigation.navigate('Chat', {conversationId: conv.id});
  }

  async function handleSearchByImage(): Promise<void> {
    try {
      const img = await pickImage();
      if (!img) return;
      const conv = db.conversations.create('Image chat');
      navigation.navigate('Chat', {
        conversationId: conv.id,
        initialImageUri: img.uri,
        initialImageName: img.name,
      });
    } catch (err) {
      Alert.alert('Could not pick image', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <View style={styles.screen}>
      <GradientBackground gradientId="homeBg" startColor="#F8F6FF" endColor="#DDD6FE" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{greeting()}</Text>
            <Text style={styles.appName}>{'akhr'}</Text>
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.gearIcon}>{'⚙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Feature cards */}
        <View style={styles.cardRow}>
          <TouchableOpacity style={styles.card} onPress={() => void handleSearchByImage()}>
            <SearchIcon color={colors.purple} size={30} />
            <Text style={styles.cardLabel}>{'Search by image'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={handleNewChat}>
            <NewChatIcon color={colors.purple} size={30} />
            <Text style={styles.cardLabel}>{'Start new chat'}</Text>
          </TouchableOpacity>
        </View>

        {/* Recent chats */}
        {recents.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{'Recent chats'}</Text>
            {recents.map((conv, idx) => (
              <React.Fragment key={conv.id}>
                <TouchableOpacity
                  style={styles.recentRow}
                  onPress={() => navigation.navigate('Chat', {conversationId: conv.id})}>
                  <View style={styles.recentBody}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {cleanTitle(conv.title)}
                    </Text>
                    {conv.preview ? (
                      <Text style={styles.recentPreview} numberOfLines={2}>
                        {conv.preview}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.recentDate}>{formatDate(conv.updatedAt)}</Text>
                </TouchableOpacity>
                {idx < recents.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lavender,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greetingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  appName: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  gearIcon: {
    color: colors.navy,
    fontSize: 22,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'flex-start',
    gap: 12,
    // Shadow
    shadowColor: colors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentBody: {
    flex: 1,
    marginRight: 12,
  },
  recentTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  recentPreview: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  recentDate: {
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
});
