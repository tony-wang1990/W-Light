import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, fontSize } from '../../theme'

export function RecordsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设备台账</Text>
        <Text style={styles.subtitle}>设备档案 · 巡检记录 · 备件库</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderIcon}>📦</Text>
        <Text style={styles.placeholderText}>设备台账</Text>
        <Text style={styles.placeholderDesc}>查看设备档案、巡检计划和备件库存</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  placeholderIcon: { fontSize: 56, marginBottom: spacing.base },
  placeholderText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary },
  placeholderDesc: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
})
