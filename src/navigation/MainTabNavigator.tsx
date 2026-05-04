import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {MainTabParamList} from './types';
import {HomeScreen} from '@/screens/HomeScreen';
import {ConversationListScreen} from '@/screens/ConversationListScreen';
import {VoiceScreen} from '@/screens/VoiceScreen';
import {HomeIcon, ChatIcon, MicIcon} from '@/components/TabIcons';
import {colors} from '@/theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

type PillIconProps = {focused: boolean; icon: React.JSX.Element};

function PillIcon({focused, icon}: PillIconProps): React.JSX.Element {
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      {icon}
    </View>
  );
}

function TabLabel({focused, label}: {focused: boolean; label: string}): React.JSX.Element {
  return (
    <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
      {label}
    </Text>
  );
}

export function MainTabNavigator(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, {paddingBottom: insets.bottom, height: 64 + insets.bottom}],
        tabBarItemStyle: styles.tabBarItem,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <PillIcon focused={focused} icon={<HomeIcon color={focused ? '#fff' : colors.textSecondary} size={20} />} />
          ),
          tabBarLabel: ({focused}) => <TabLabel focused={focused} label="Home" />,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ConversationListScreen}
        options={{
          headerShown: true,
          headerStyle: {backgroundColor: colors.lavender},
          headerTintColor: colors.navy,
          headerShadowVisible: false,
          title: 'Chats',
          tabBarIcon: ({focused}) => (
            <PillIcon focused={focused} icon={<ChatIcon color={focused ? '#fff' : colors.textSecondary} size={20} />} />
          ),
          tabBarLabel: ({focused}) => <TabLabel focused={focused} label="Chats" />,
        }}
      />
      <Tab.Screen
        name="Voice"
        component={VoiceScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <PillIcon focused={focused} icon={<MicIcon color={focused ? '#fff' : colors.textSecondary} size={20} />} />
          ),
          tabBarLabel: ({focused}) => <TabLabel focused={focused} label="Voice" />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarItem: {
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
  },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.purple,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.purple,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
