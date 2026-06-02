import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ToolboxStackParamList } from './types';
import { ToolboxScreen } from '../screens/toolbox/ToolboxScreen';
import { DmxScreen } from '../screens/toolbox/DmxScreen';
import { PowerCalcScreen } from '../screens/toolbox/PowerCalcScreen';
import { BeamAngleScreen } from '../screens/toolbox/BeamAngleScreen';
import { BpmScreen } from '../screens/toolbox/BpmScreen';
import { DiagnosisScreen } from '../screens/toolbox/DiagnosisScreen';
import { MaMacrosScreen } from '../screens/toolbox/MaMacrosScreen';
import { TermsScreen } from '../screens/toolbox/TermsScreen';
import { LuxScreen } from '../screens/toolbox/LuxScreen';
import { RgbColorScreen } from '../screens/toolbox/RgbColorScreen';
import { LightLayoutScreen } from '../screens/toolbox/LightLayoutScreen';
import { TheoryScreen } from '../screens/toolbox/TheoryScreen';

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
      <Stack.Screen name="Diagnosis" component={DiagnosisScreen} />
      <Stack.Screen name="MaMacros" component={MaMacrosScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Lux" component={LuxScreen} />
      <Stack.Screen name="RgbColor" component={RgbColorScreen} />
      <Stack.Screen name="LightLayout" component={LightLayoutScreen} />
      <Stack.Screen name="Theory" component={TheoryScreen} />
    </Stack.Navigator>
  );
}
