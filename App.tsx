import React, {useEffect, useState} from 'react';
import {StatusBar, useColorScheme, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/navigation/RootNavigator';
import {initFeatureFlags} from './src/config/featureFlags';
import {initDb} from './src/db';
import {logger} from './src/utils/logger';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    void initFeatureFlags();
    initDb()
      .then(() => setDbReady(true))
      .catch(err => {
        logger.error('Failed to initialise encrypted DB', err);
        // Still mark ready — screens will throw on DB access, which ErrorBoundary catches.
        setDbReady(true);
      });
  }, []);

  if (!dbReady) {
    // Match splash background so there's no visible flash.
    return <View style={{flex: 1, backgroundColor: '#1A1A1A'}} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
