/**
 * @format
 */

// Polyfill crypto.getRandomValues() for uuid on Hermes (React Native).
// Must be the first import — uuid reads crypto at module load time.
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
