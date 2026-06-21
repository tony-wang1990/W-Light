import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native'
import {
  type NavigationProp,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { usersApi } from '../../api/users.api'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityTag } from '../../components/common/PriorityTag'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { OrdersStackParamList } from '../../navigation/types'
import type { WorkOrder, RepairLog, User } from '../../types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { getErrorMessage } from '../../utils/error'

const ASSIGNABLE_ROLES: User['role'][] = ['admin', 'engineer']

const ROLE_LABELS: Record<User['role'], string> = {
  admin: '管理员',
  engineer: '维修工程师',
  inspector: '巡检人员',
  viewer: '只读账号',
}

function getWorkloadMeta(engineer: User) {
  const count = engineer.activeOrderCount
  if (count === undefined) {
    return { label: '未同步', color: colors.textSecondary, bg: colors.borderLight }
  }
  if (engineer.busyStatus === 'overloaded' || count >= 3) {
    return { label: `${count} 单`, color: colors.danger, bg: colors.danger + '22' }
  }
  if (engineer.busyStatus === 'busy' || count > 0) {
    return { label: `${count} 单`, color: colors.warning, bg: colors.warning + '22' }
  }
  return { label: '空闲', color: colors.success, bg: colors.success + '22' }
}

function getSkillScore(engineer: User, order: WorkOrder | null) {
  const tags = engineer.skillTags || []
  if (!order || tags.length === 0) return 0

  const terms = [
    order.faultType,
    order.category,
    order.device?.category,
    order.device?.name,
  ]
    .filter(Boolean)
    .map(item => String(item).toLowerCase())

  return tags.reduce((score, tag) => {
    const normalizedTag = tag.toLowerCase()
    return terms.some(term => term.includes(normalizedTag) || normalizedTag.includes(term))
      ? score + 1
      : score
  }, 0)
}

export function OrderDetailScreen() {
  const navigation = useNavigation<NavigationProp<OrdersStackParamList>>()
  const route = useRoute<RouteProp<OrdersStackParamList, 'OrderDetail'>>()
  const { user } = useAuthStore()
  const { orderId } = route.params

  const [order, setOrder] = useState<WorkOrder | null>(null)
  const [logs, setLogs] = useState<RepairLog[]>([])
  const [engineers, setEngineers] = useState<User[]>([])
  const [engineerSearch, setEngineerSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDetail = async () => {
    try {
      const [orderData, logsData] = await Promise.all([
        ordersApi.getById(orderId),
        ordersApi.getRepairLogs(orderId),
      ])
      setOrder(orderData)
      setLogs(logsData)
    } catch (e: unknown) {
      Alert.alert('错误', getErrorMessage(e, '加载工单详情失败'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchEngineers = async () => {
    if (user?.role !== 'admin') return
    try {
      const users = await usersApi.list({ includeWorkload: true })
      setEngineers(users.filter(item => ASSIGNABLE_ROLES.includes(item.role)))
    } catch (error) {
      console.warn('Failed to load engineers', error)
    }
  }

  useEffect(() => { fetchDetail() }, [orderId])

  useEffect(() => {
    void fetchEngineers()
  }, [user?.role])

  const handleAction = async (action: string) => {
    if (!order) return
    try {
      let updated: WorkOrder
      switch (action) {
        case 'accept': updated = await ordersApi.accept(order.id); break
        case 'reject': updated = await ordersApi.reject(order.id, '现场无法接单，请管理员重新派单'); break
        case 'suspend': updated = await ordersApi.suspend(order.id, '等待备件、现场条件或进一步确认'); break
        case 'submit': updated = await ordersApi.submit(order.id); break
        case 'resume': updated = await ordersApi.resume(order.id); break
        case 'accept-check':
          updated = await ordersApi.acceptCheck(order.id); break
        case 'reject-check':
          updated = await ordersApi.rejectCheck(order.id, '验收退回，请补充维修记录或现场照片'); break
        default: return
      }
      setOrder(updated)
      await fetchDetail()
      Alert.alert('✅ 成功', '操作已完成')
    } catch (e: unknown) {
      Alert.alert('操作失败', getErrorMessage(e))
    }
  }

  const handleAssign = async (assigneeId: string) => {
    if (!order) return
    try {
      const updated = await ordersApi.assign(order.id, assigneeId)
      setOrder(updated)
      await fetchDetail()
      await fetchEngineers()
      Alert.alert('✅ 已派单', '工单已指派给维修人员')
    } catch (e: unknown) {
      Alert.alert('派单失败', getErrorMessage(e))
    }
  }

  const confirmAction = (action: string, title: string, message?: string) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'default', onPress: () => handleAction(action) },
    ])
  }

  const filteredEngineers = useMemo(() => {
    const keyword = engineerSearch.trim().toLowerCase()

    return engineers
      .filter(engineer => {
        if (!keyword) return true
        const searchText = [
          engineer.name,
          engineer.phone,
          ROLE_LABELS[engineer.role],
          ...(engineer.skillTags || []),
        ].join(' ').toLowerCase()
        return searchText.includes(keyword)
      })
      .sort((a, b) => {
        const aSelected = order?.assigneeId === a.id
        const bSelected = order?.assigneeId === b.id
        if (aSelected !== bSelected) return aSelected ? -1 : 1

        const skillDiff = getSkillScore(b, order) - getSkillScore(a, order)
        if (skillDiff !== 0) return skillDiff

        const loadDiff = (a.activeOrderCount || 0) - (b.activeOrderCount || 0)
        if (loadDiff !== 0) return loadDiff

        return a.name.localeCompare(b.name, 'zh-Hans-CN')
      })
  }, [engineerSearch, engineers, order])

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

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchDetail()
            }}
            tintColor={colors.primary}
          />
        }
      >
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
          {order.mediaUrls && order.mediaUrls.length > 0 && (
            <View style={styles.mediaBox}>
              <Text style={styles.mediaTitle}>现场附件</Text>
              {order.mediaUrls.map((url, index) => (
                <Text key={`${url}-${index}`} style={styles.mediaText} numberOfLines={1}>
                  附件 {index + 1}: {url}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>处理进度</Text>
          <Timeline order={order} />
        </View>

        {/* Repair Logs */}
        {isAdmin && ['pending', 'assigned'].includes(order.status) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>派单</Text>
            {engineers.length > 0 ? (
              <>
                <TextInput
                  value={engineerSearch}
                  onChangeText={setEngineerSearch}
                  placeholder="搜索姓名、手机号、技能"
                  placeholderTextColor={colors.textMuted}
                  style={styles.engineerSearchInput}
                />
                {filteredEngineers.length > 0 ? (
                  <View style={styles.engineerList}>
                    {filteredEngineers.map(engineer => {
                      const selected = order.assigneeId === engineer.id
                      const workload = getWorkloadMeta(engineer)
                      const skillTags = engineer.skillTags || []

                      return (
                        <TouchableOpacity
                          key={engineer.id}
                          style={[
                            styles.engineerCard,
                            selected && styles.engineerCardActive,
                          ]}
                          onPress={() => handleAssign(engineer.id)}
                        >
                          <View style={styles.engineerCardHeader}>
                            <View style={styles.engineerIdentity}>
                              <Text style={[styles.engineerName, selected && styles.engineerTextActive]}>
                                {engineer.name}
                              </Text>
                              <Text style={[styles.engineerRole, selected && styles.engineerSubTextActive]}>
                                {ROLE_LABELS[engineer.role]} · {engineer.phone || '无手机号'}
                              </Text>
                            </View>
                            <View style={[styles.workloadBadge, { backgroundColor: workload.bg, borderColor: workload.color }]}>
                              <Text style={[styles.workloadText, { color: workload.color }]}>{workload.label}</Text>
                            </View>
                          </View>

                          <View style={styles.skillRow}>
                            {skillTags.length > 0 ? (
                              skillTags.slice(0, 4).map(tag => (
                                <Text key={`${engineer.id}-${tag}`} style={[
                                  styles.skillTag,
                                  selected && styles.skillTagActive,
                                ]}>
                                  {tag}
                                </Text>
                              ))
                            ) : (
                              <Text style={[styles.noSkillText, selected && styles.engineerSubTextActive]}>
                                未配置技能
                              </Text>
                            )}
                          </View>

                          <Text style={[styles.assignHint, selected && styles.engineerTextActive]}>
                            {selected ? '当前负责人' : '指派'}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>没有匹配的派单人员</Text>
                )}
              </>
            ) : (
              <Text style={styles.emptyHint}>暂无可派单人员</Text>
            )}
          </View>
        )}

        {/* Repair Logs */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>维修记录 ({logs.length})</Text>
            {logs.map(log => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logStep}>{log.stepType}</Text>
                  <Text style={styles.logTime}>{format(new Date(log.loggedAt), 'MM-dd HH:mm')}</Text>
                </View>
                <Text style={styles.logDesc}>{log.stepDesc}</Text>
                {log.photoUrls && log.photoUrls.length > 0 && (
                  <View style={styles.mediaBox}>
                    <Text style={styles.mediaTitle}>维修附件</Text>
                    {log.photoUrls.map((url, index) => (
                      <Text key={`${log.id}-${url}-${index}`} style={styles.mediaText} numberOfLines={1}>
                        附件 {index + 1}: {url}
                      </Text>
                    ))}
                  </View>
                )}
                {log.partUsages && log.partUsages.length > 0 && (
                  <View style={styles.partsUsedBox}>
                    <Text style={styles.partsUsedTitle}>更换备件</Text>
                    {log.partUsages.map(part => (
                      <Text key={`${log.id}-${part.partId}`} style={styles.partsUsedText}>
                        {part.name || part.partId} × {part.quantity}{part.unit || ''}
                      </Text>
                    ))}
                  </View>
                )}
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
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => confirmAction('reject', '拒单', '确认拒绝此工单并退回待派单？')}
            >
              <Text style={styles.actionBtnText}>拒单</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => confirmAction('accept', '接单', '确认接收此工单并开始处理？')}
            >
              <Text style={styles.actionBtnText}>✅ 接单</Text>
            </TouchableOpacity>
          </>
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
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => confirmAction('suspend', '挂起工单', '确认暂时挂起此工单？')}
            >
              <Text style={styles.actionBtnText}>挂起</Text>
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
              onPress={() => confirmAction('reject-check', '验收退回', '确认退回给维修人员继续处理？')}
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
  mediaBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mediaTitle: { fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '700' },
  mediaText: { fontSize: fontSize.xs, color: colors.primary, lineHeight: 18 },
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
  partsUsedBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partsUsedTitle: { fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '700' },
  partsUsedText: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  logEngineer: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  engineerSearchInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    marginBottom: spacing.sm,
  },
  engineerList: { gap: spacing.sm },
  engineerCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  engineerCardActive: { backgroundColor: colors.primary, borderColor: colors.primaryLight },
  engineerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' },
  engineerIdentity: { flex: 1 },
  engineerName: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700' },
  engineerRole: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3 },
  engineerTextActive: { color: colors.white },
  engineerSubTextActive: { color: colors.white + 'CC' },
  workloadBadge: {
    minWidth: 56,
    height: 24,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workloadText: { fontSize: fontSize.xs, fontWeight: '700' },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  skillTag: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  skillTagActive: { color: colors.white, backgroundColor: colors.primaryDark },
  noSkillText: { fontSize: fontSize.xs, color: colors.textMuted },
  assignHint: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyHint: { fontSize: fontSize.xs, color: colors.textMuted },
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
