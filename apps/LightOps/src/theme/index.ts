export const colors = {
  // Backgrounds
  background: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#21262D',
  border: '#30363D',
  borderLight: '#21262D',

  // Primary
  primary: '#007AFF',
  primaryDark: '#0055B3',
  primaryLight: '#4DA3FF',

  // Status colors
  success: '#3FB950',
  warning: '#D29922',
  danger: '#F85149',
  info: '#58A6FF',

  // Priority colors
  p0: '#FF3B30',
  p1: '#FF9500',
  p2: '#007AFF',
  p3: '#8B949E',

  // Order status colors
  pending: '#D29922',
  assigned: '#58A6FF',
  processing: '#3FB950',
  suspended: '#8B949E',
  reviewing: '#BC8CFF',
  closed: '#3FB950',
  rejected: '#F85149',

  // Text
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
  textInverse: '#0D1117',

  // Special
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(1, 4, 9, 0.8)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
