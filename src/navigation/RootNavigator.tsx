import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {CompatibilityScreen} from '@/screens/CompatibilityScreen';
import {BlockedScreen} from '@/screens/BlockedScreen';
import {DownloadScreen} from '@/screens/DownloadScreen';
import {ChatScreen} from '@/screens/ChatScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {MainTabNavigator} from './MainTabNavigator';
import {WelcomeScreen} from '@/screens/WelcomeScreen';
import {ErrorBoundary, withErrorBoundary} from '@/components/ErrorBoundary';
import {colors} from '@/theme/colors';

const headerTheme = {
  headerStyle: {backgroundColor: colors.lavender},
  headerTintColor: colors.navy,
  headerShadowVisible: false,
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const CompatibilityScreenBounded = withErrorBoundary(CompatibilityScreen, 'CompatibilityScreen');
const BlockedScreenBounded = withErrorBoundary(BlockedScreen, 'BlockedScreen');
const DownloadScreenBounded = withErrorBoundary(DownloadScreen, 'DownloadScreen');
const ChatScreenBounded = withErrorBoundary(ChatScreen, 'ChatScreen');
const SettingsScreenBounded = withErrorBoundary(SettingsScreen, 'SettingsScreen');

export function RootNavigator(): React.JSX.Element {
  return (
    <ErrorBoundary label="App failed to start">
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Compatibility" screenOptions={{headerShown: false}}>
          <Stack.Screen name="Compatibility" component={CompatibilityScreenBounded} />
          <Stack.Screen name="Blocked" component={BlockedScreenBounded} />
          <Stack.Screen name="Download" component={DownloadScreenBounded} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="Chat"
            component={ChatScreenBounded}
            options={{...headerTheme, headerShown: true, title: ''}}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreenBounded}
            options={{...headerTheme, headerShown: true, title: 'Settings'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
