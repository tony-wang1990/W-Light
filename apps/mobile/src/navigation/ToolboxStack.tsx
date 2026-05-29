import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ToolboxStackParamList } from './types';
import ToolboxScreen from '../screens/toolbox/ToolboxScreen';
import DmxScreen from '../screens/toolbox/DmxScreen';
import PowerCalcScreen from '../screens/toolbox/PowerCalcScreen';
import BeamAngleScreen from '../screens/toolbox/BeamAngleScreen';
import BpmScreen from '../screens/toolbox/BpmScreen';

const Stack = createNativeStackNavigator<ToolboxStackParamList>();

export function ToolboxStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="ToolboxMain" component={ToolboxScreen} />
      <Stack.Screen name="Dmx" component={DmxScreen} />
      <Stack.Screen name="PowerCalc" component={PowerCalcScreen} />
      <Stack.Screen name="BeamAngle" component={BeamAngleScreen} />
      <Stack.Screen name="Bpm" component={BpmScreen} />
    </Stack.Navigator>
  );
}
