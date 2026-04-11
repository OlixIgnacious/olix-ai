/**
 * Smoke test — verifies the module graph resolves without runtime errors.
 * Full integration tests live alongside each module.
 */

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
  useNavigation: jest.fn(),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: {children: React.ReactNode}) => children,
    Screen: () => null,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

jest.mock('react-native-config', () => ({
  APP_ENV: 'dev',
  APP_DISPLAY_NAME: 'Olix Dev',
  BUNDLE_ID: 'com.olix.dev',
  MODEL_CDN_URL: 'https://dev-cdn.example.com/models',
  SENTRY_DSN: '',
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('App renders without crashing', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
