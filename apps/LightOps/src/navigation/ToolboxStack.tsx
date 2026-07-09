import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ToolboxStackParamList } from './types';
import { ToolboxScreen } from '../screens/toolbox/ToolboxScreen';
import { DmxScreen } from '../screens/toolbox/DmxScreen';
import { FixtureLibraryScreen } from '../screens/toolbox/FixtureLibraryScreen';
import { PowerCalcScreen } from '../screens/toolbox/PowerCalcScreen';
import { CableDropScreen } from '../screens/toolbox/CableDropScreen';
import { ArtNetScreen } from '../screens/toolbox/ArtNetScreen';
import { BeamAngleScreen } from '../screens/toolbox/BeamAngleScreen';
import { BpmScreen } from '../screens/toolbox/BpmScreen';
import { LuxScreen } from '../screens/toolbox/LuxScreen';
import { LtcScreen } from '../screens/toolbox/LtcScreen';
import { RgbColorScreen } from '../screens/toolbox/RgbColorScreen';

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
      <Stack.Screen name="FixtureLibrary" component={FixtureLibraryScreen} />
      <Stack.Screen name="PowerCalc" component={PowerCalcScreen} />
      <Stack.Screen name="CableDrop" component={CableDropScreen} />
      <Stack.Screen name="ArtNet" component={ArtNetScreen} />
      <Stack.Screen name="BeamAngle" component={BeamAngleScreen} />
      <Stack.Screen name="Bpm" component={BpmScreen} />
      <Stack.Screen name="Ltc" component={LtcScreen} />
      <Stack.Screen name="Lux" component={LuxScreen} />
      <Stack.Screen name="RgbColor" component={RgbColorScreen} />
    </Stack.Navigator>
  );
}
