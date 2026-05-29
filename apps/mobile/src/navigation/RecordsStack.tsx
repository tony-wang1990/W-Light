import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { RecordsStackParamList } from './types';
import RecordsScreen from '../screens/records/RecordsScreen';

const Stack = createNativeStackNavigator<RecordsStackParamList>();

export function RecordsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="RecordsList" component={RecordsScreen} />
    </Stack.Navigator>
  );
}
