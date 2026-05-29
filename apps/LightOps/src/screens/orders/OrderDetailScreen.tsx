import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityTag } from '../../components/common/PriorityTag'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { WorkOrder, RepairLog } from '../../types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function OrderDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { user } = useAuthStore()
  const { orderId } = route.params

  const [order, setOrder] = useState<WorkOrder | null>(null)
  const [logs, setLogs] = useState<RepairLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDetail = async () => {
    try {
      const [orderData, logsData] = await Promise.all([
        ordersApi.getById(orderId),
        ordersApi.getRepairLogs(orderId),
      ])
      setOrder(orderData)
      setLogs(logsData)
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [orderId])

  const handleAction = async (action: string, reason?: string) => {
    if (!order) return
    try {
      let updated: WorkOrder
      switch (action) {
        case 'accept': updated = await ordersApi.accept(order.id); break
        case 'submit': updated = await ordersApi.submit(order.id); break
        case 'resume': updated = await ordersApi.resume(order.id); break
        case 'accept-check':
          updated = await ordersApi.acceptCheck(order.id); break
        default: return
      }
      setOrder(updated)
      Alert.alert('✅ 成功', '操作已完成')
    } catch (e: any) {
      Alert.alert('操作失败', e.message)
    }
  }

  const confirmAction = (action: string, title: string, message?: string) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'default', onPress: () => handleAction(action) },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!order) return null

  const isAssignee = order.assigneeId === user?.id
  const isAdmin = user?.role === 'admin'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <PriorityTag priority={order.priority} />
          <StatusBadge status={order.status} />
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Order Number */}
        <Text style={styles.orderNo}>{order.orderNo}</Text>

        {/* Device Info */}
        {order.device && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>设备信息</Text>
            <InfoRow label="设备名称" value={order.device.name} />
            <InfoRow label="设备编号" value={order.device.deviceNo} />
            <InfoRow label="位置" value={order.device.location || '未知'} />
            {order.device.dmxAddress && (
              <InfoRow label="DMX地址" value={`${order.device.dmxAddress}~${order.device.dmxAddress + (order.device.channelCount || 1) - 1}`} />
            )}
          </View>
        )}

        {/* Fault Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>故障信息</Text>
          <InfoRow label="故障类型" value={order.faultType || '未分类'} />
          <InfoRow label="故障时间" value={order.faultAt ? format(new Date(order.faultAt), 'yyyy-MM-dd HH:mm', { locale: zhCN }) : '未知'} />
          <InfoRow label="报修人" value={order.reporter?.name || '未知'} />
          <View style={styles.descBox}>
            <Text style={styles.descText}>{order.faultDesc}</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>处理进度</Text>
          <Timeline order={order} />
        </View>

        {/* Repair Logs */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>维修记录 ({logs.length})</Text>
            {logs.map((log, i) => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logStep}>{log.stepType}</Text>
                  <Text style={styles.logTime}>{format(new Date(log.loggedAt), 'MM-dd HH:mm')}</Text>
                </View>
                <Text style={styles.logDesc}>{log.stepDesc}</Text>
                {log.engineer && (
                  <Text style={styles.logEngineer}>👤 {log.engineer.name}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        {/* Engineer Actions */}
        {isAssignee && order.status === 'assigned' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => confirmAction('accept', '接单', '确认接收此工单并开始处理？')}
          >
            <Text style={styles.actionBtnText}>✅ 接单</Text>
          </TouchableOpacity>
        )}
        {isAssignee && order.status === 'processing' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('OrderRepair', { orderId: order.id })}
            >
              <Text style={styles.actionBtnTextSec}>+ 添加记录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => confirmAction('submit', '提交验收', '确认已完成维修，提交给管理员验收？')}
            >
              <Text style={styles.actionBtnText}>📤 提交验收</Text>
            </TouchableOpacity>
          </>
        )}
        {isAssignee && order.status === 'suspended' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => confirmAction('resume', '恢复工单', '确认恢复处理此工单？')}
          >
            <Text style={styles.actionBtnText}>▶️ 恢复处理</Text>
          </TouchableOpacity>
        )}
        {/* Admin Actions */}
        {isAdmin && order.status === 'reviewing' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => Alert.alert('验收退回', '请填写退回原因')}
            >
              <Text style={styles.actionBtnText}>↩️ 退回</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => confirmAction('accept-check', '验收通过', '确认工单维修完成，通过验收？')}
            >
              <Text style={styles.actionBtnText}>✅ 通过验收</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  value: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: spacing.sm },
})

function Timeline({ order }: { order: WorkOrder }) {
  const steps = [
    { label: '报修创建', time: order.createdAt, done: true },
    { label: '已派单', time: order.assignedAt, done: !!order.assignedAt },
    { label: '处理中', time: order.startedAt, done: !!order.startedAt },
    { label: '待验收', time: order.submittedAt, done: !!order.submittedAt },
    { label: '完成', time: order.closedAt, done: !!order.closedAt },
  ]
  return (
    <View>
      {steps.map((step, i) => (
        <View key={i} style={timelineStyles.item}>
          <View style={[timelineStyles.dot, step.done && timelineStyles.dotDone]} />
          {i < steps.length - 1 && <View style={timelineStyles.line} />}
          <View style={timelineStyles.content}>
            <Text style={[timelineStyles.label, step.done && timelineStyles.labelDone]}>{step.label}</Text>
            {step.time && (
              <Text style={timelineStyles.time}>
                {format(new Date(step.time), 'MM-dd HH:mm', { locale: zhCN })}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

const timelineStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 4, marginRight: 10 },
  dotDone: { backgroundColor: colors.primary },
  line: { position: 'absolute', left: 4, top: 14, width: 2, height: 24, backgroundColor: colors.border },
  content: { flex: 1, paddingBottom: 16 },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  labelDone: { color: colors.textPrimary, fontWeight: '500' },
  time: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  headerRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  body: { flex: 1 },
  orderNo: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  descText: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 22 },
  logItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logStep: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  logTime: { fontSize: fontSize.xs, color: colors.textMuted },
  logDesc: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  logEngineer: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  // Action Bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnDanger: { backgroundColor: colors.danger },
  actionBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  actionBtnTextSec: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
})
