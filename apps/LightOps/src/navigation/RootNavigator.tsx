import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { MainTabNavigator } from './MainTabNavigator'
import { colors } from '../theme'
import { subscribeSessionExpired } from '../auth/sessionEvents'

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const { isAuthenticated, currentProjectId, initFromStorage, logout } = useAuthStore()

  useEffect(() => {
    // 从本地存储恢复登录状态
    initFromStorage()
  }, [])

  useEffect(() => subscribeSessionExpired(logout), [logout])

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.danger,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="MainTabs">
            {() => <MainTabNavigator key={currentProjectId || 'no-project'} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
