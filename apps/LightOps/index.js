/**
 * @format
 */
import 'react-native-gesture-handler';

import React, { useEffect, useState } from 'react';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {initializeSecureStorageEncryption} from './src/storage/secureStorage';

function Root() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    initializeSecureStorageEncryption().finally(() => {
      // Lazy load App to ensure storage is ready before any module scope code runs
      const AppComponent = require('./App').default;
      setApp(() => AppComponent);
    });
  }, []);

  if (!App) {
    return null;
  }

  return <App />;
}

// CRITICAL: registerComponent MUST be called synchronously at the top level
AppRegistry.registerComponent(appName, () => Root);
