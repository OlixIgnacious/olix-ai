import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {CompatibilityScreen} from '@/screens/CompatibilityScreen';
import {BlockedScreen} from '@/screens/BlockedScreen';
import {DownloadScreen} from '@/screens/DownloadScreen';
import {ConversationListScreen} from '@/screens/ConversationListScreen';
import {ChatScreen} from '@/screens/ChatScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Compatibility" screenOptions={{headerShown: false}}>
        <Stack.Screen name="Compatibility" component={CompatibilityScreen} />
        <Stack.Screen name="Blocked" component={BlockedScreen} />
        <Stack.Screen name="Download" component={DownloadScreen} />
        <Stack.Screen
          name="ConversationList"
          component={ConversationListScreen}
          options={{headerShown: true, title: 'Olix'}}
        />
        <Stack.Screen name="Chat" component={ChatScreen} options={{headerShown: true, title: ''}} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{headerShown: true, title: 'Settings'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
