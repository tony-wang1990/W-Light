import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { RecordsStackParamList } from './types';
import { RecordsScreen } from '../screens/records/RecordsScreen';
import { DeviceDetailScreen } from '../screens/records/DeviceDetailScreen';
import { DeviceCreateScreen } from '../screens/records/DeviceCreateScreen';

const Stack = createNativeStackNavigator<RecordsStackParamList>();

export function RecordsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="RecordsList" component={RecordsScreen} />
      <Stack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
      <Stack.Screen name="DeviceCreate" component={DeviceCreateScreen} />
    </Stack.Navigator>
  );
}
