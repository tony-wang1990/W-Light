import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 64 }: LogoProps) {
  const borderRadius = size * 0.22; // Typical rounded rectangle ratio
  const fontSize = size * 0.6; // W size relative to box

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.text, { fontSize }]}>W</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1EAE98', // Teal color matching the user's image
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1EAE98',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: 'System',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
