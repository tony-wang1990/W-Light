import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { OrderStatus } from '../../types'
import { colors, radius, fontSize } from '../../theme'

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending:    { label: '待派单', bg: colors.warning + '33',  text: colors.warning },
  assigned:   { label: '已派单', bg: colors.info + '33',     text: colors.info },
  processing: { label: '处理中', bg: colors.success + '33',  text: colors.success },
  suspended:  { label: '已挂起', bg: colors.textMuted + '33', text: colors.textSecondary },
  reviewing:  { label: '待验收', bg: '#BC8CFF33',            text: '#BC8CFF' },
  closed:     { label: '已完成', bg: colors.success + '22',  text: colors.success },
  rejected:   { label: '已取消', bg: colors.danger + '22',   text: colors.danger },
}

interface StatusBadgeProps {
  status: OrderStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, bg: colors.surface, text: colors.textSecondary }

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      size === 'sm' && styles.badgeSm,
    ]}>
      <Text style={[
        styles.label,
        { color: config.text },
        size === 'sm' && styles.labelSm,
      ]}>
        {config.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelSm: {
    fontSize: 10,
  },
})
