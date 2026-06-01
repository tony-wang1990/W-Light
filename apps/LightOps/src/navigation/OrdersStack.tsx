import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { OrdersStackParamList } from './types';
import { OrderListScreen } from '../screens/orders/OrderListScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrderCreateScreen } from '../screens/orders/OrderCreateScreen';
import { OrderRepairScreen } from '../screens/orders/OrderRepairScreen';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="OrderList" component={OrderListScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OrderCreate" component={OrderCreateScreen} />
      <Stack.Screen name="OrderRepair" component={OrderRepairScreen} />
    </Stack.Navigator>
  );
}
