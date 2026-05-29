import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { OrderPriority } from '../../types'
import { colors, radius, fontSize } from '../../theme'

const PRIORITY_CONFIG: Record<OrderPriority, { label: string; color: string }> = {
  P0: { label: 'P0 紧急', color: colors.p0 },
  P1: { label: 'P1 高',   color: colors.p1 },
  P2: { label: 'P2 中',   color: colors.p2 },
  P3: { label: 'P3 低',   color: colors.p3 },
}

export function PriorityTag({ priority }: { priority: OrderPriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <View style={[styles.tag, { borderColor: config.color }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
})
