/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {initializeSecureStorageEncryption} from './src/storage/secureStorage';

function registerApp() {
  const App = require('./App').default;
  AppRegistry.registerComponent(appName, () => App);
}

initializeSecureStorageEncryption().finally(registerApp);
