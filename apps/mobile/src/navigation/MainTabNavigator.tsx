import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { HomeScreen } from '../screens/home/HomeScreen'
import { OrderListScreen } from '../screens/orders/OrderListScreen'
import { ToolboxScreen } from '../screens/toolbox/ToolboxScreen'
import { RecordsScreen } from '../screens/records/RecordsScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Orders: '📋',
    Toolbox: '🔧',
    Records: '📦',
    Profile: '👤',
  }
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.iconEmoji, focused && styles.iconFocused]}>
        {icons[name]}
      </Text>
    </View>
  )
}

const tabLabels: Record<string, string> = {
  Home: '首页',
  Orders: '工单',
  Toolbox: '工具箱',
  Records: '台账',
  Profile: '我的',
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabel: ({ focused, color }) => (
          <Text style={[styles.tabLabel, { color }]}>
            {tabLabels[route.name]}
          </Text>
        ),
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrderListScreen} />
      <Tab.Screen name="Toolbox" component={ToolboxScreen} />
      <Tab.Screen name="Records" component={RecordsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 4,
    height: 60,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 28,
  },
  iconEmoji: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
})
