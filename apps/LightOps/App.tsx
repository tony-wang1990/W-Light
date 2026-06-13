/**
 * LightOps — 文旅灯光运维一体化APP
 * @format
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { RootNavigator } from './src/navigation/RootNavigator';
import { syncOfflineQueue, getOfflineQueue, isOfflineAutoSyncEnabled } from './src/offline/offlineQueue';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      gcTime: 300000,
    },
  },
});

function App(): React.JSX.Element {
  React.useEffect(() => {
    // 监听网络状态，当网络恢复且存在离线任务时，自动触发后台同步
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false && isOfflineAutoSyncEnabled()) {
        const queue = getOfflineQueue();
        if (queue.length > 0) {
          syncOfflineQueue().catch(() => undefined);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default App;
