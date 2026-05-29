import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { WorkOrder } from '../../types'
import { StatusBadge } from '../common/StatusBadge'
import { PriorityTag } from '../common/PriorityTag'
import { colors, spacing, fontSize, radius } from '../../theme'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface OrderCardProps {
  order: WorkOrder
  onPress?: () => void
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  const isOvertime = order.isOvertime && !['closed', 'rejected'].includes(order.status)

  return (
    <TouchableOpacity
      style={[styles.card, isOvertime && styles.cardOvertime]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        <Text style={styles.orderNo}>{order.orderNo}</Text>
        <View style={styles.tagRow}>
          <PriorityTag priority={order.priority} />
          {isOvertime && (
            <View style={styles.overtimeTag}>
              <Text style={styles.overtimeText}>⚠️ 超时</Text>
            </View>
          )}
        </View>
      </View>

      {/* Device Name */}
      {order.device && (
        <Text style={styles.deviceName}>
          📡 {order.device.name} · {order.device.location || '未知位置'}
        </Text>
      )}

      {/* Fault Description */}
      <Text style={styles.faultDesc} numberOfLines={2}>
        {order.faultDesc}
      </Text>

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        <StatusBadge status={order.status} size="sm" />
        <View style={styles.metaRow}>
          {order.assignee && (
            <Text style={styles.metaText}>👤 {order.assignee.name}</Text>
          )}
          <Text style={styles.metaText}>
            {formatDistanceToNow(new Date(order.createdAt), { locale: zhCN, addSuffix: true })}
          </Text>
        </View>
      </View>

      {/* SLA Progress */}
      {order.slaDeadline && !['closed', 'rejected'].includes(order.status) && (
        <SlaBar deadline={order.slaDeadline} createdAt={order.createdAt} isOvertime={isOvertime} />
      )}
    </TouchableOpacity>
  )
}

function SlaBar({
  deadline,
  createdAt,
  isOvertime,
}: {
  deadline: string
  createdAt: string
  isOvertime: boolean
}) {
  const created = new Date(createdAt).getTime()
  const end = new Date(deadline).getTime()
  const now = Date.now()
  const total = end - created
  const elapsed = now - created
  const progress = Math.min(elapsed / total, 1)

  const barColor = isOvertime
    ? colors.danger
    : progress > 0.75
    ? colors.warning
    : colors.success

  return (
    <View style={slaStyles.container}>
      <View style={slaStyles.track}>
        <View style={[slaStyles.fill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[slaStyles.label, { color: barColor }]}>
        {isOvertime ? '⚠️ 已超时' : `SLA ${Math.round(progress * 100)}%`}
      </Text>
    </View>
  )
}

const slaStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  track: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 9, fontWeight: '600', minWidth: 50 },
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOvertime: {
    borderColor: colors.danger + '66',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNo: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  tagRow: { flexDirection: 'row', gap: 6 },
  overtimeTag: {
    backgroundColor: colors.danger + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  overtimeText: { fontSize: 10, color: colors.danger, fontWeight: '600' },
  deviceName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  faultDesc: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
})
