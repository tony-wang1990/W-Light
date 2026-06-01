import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { ordersApi } from '../../api/orders.api'
import { devicesApi } from '../../api/devices.api'
import { inspectionsApi } from '../../api/inspections.api'
import { colors, spacing, fontSize, radius } from '../../theme'

interface Summary {
  pending: number
  processing: number
  reviewing: number
  suspended: number
}

const QUICK_ACTIONS = [
  { icon: '📸', label: '扫码查验', route: 'ScanMock', color: colors.danger },
  { icon: '📋', label: '创建工单', route: 'OrderCreate', color: colors.primary },
  { icon: '🔧', label: '工具箱', route: 'Toolbox', color: '#C77DFF' },
  { icon: '📦', label: '备件查询', route: 'Records', color: '#FFD93D' },
]

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<Summary>({ pending: 0, processing: 0, reviewing: 0, suspended: 0 })
  const [todayInspections, setTodayInspections] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboard = async () => {
    try {
      const [data, plans] = await Promise.all([
        ordersApi.summary(),
        inspectionsApi.getTodayPlans().catch(() => []),
      ])
      setSummary({
        pending: (data.pending || 0) + (data.assigned || 0),
        processing: data.processing || 0,
        reviewing: data.reviewing || 0,
        suspended: data.suspended || 0,
      })
      setTodayInspections(plans.length)
    } catch (error) {
      console.warn('Failed to load order summary', error)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboard()
    setRefreshing(false)
  }

  const handleQuickAction = async (route: string) => {
    if (route === 'ScanMock') {
      try {
        // Mock a QR scan by fetching devices and picking the first one
        const res = await devicesApi.getList({ pageSize: 1 });
        if (res.items && res.items.length > 0) {
          const deviceId = res.items[0].id;
          navigation.getParent()?.navigate('Records', {
            screen: 'DeviceDetail',
            params: { deviceId },
          });
        } else {
          Alert.alert('提示', '数据库中暂无设备，请先在网页端添加设备');
        }
      } catch (e) {
        console.error(e);
        Alert.alert('扫描失败', '无法连接到服务器');
      }
    } else {
      if (route === 'OrderCreate') {
        navigation.getParent()?.navigate('Orders', { screen: 'OrderCreate' });
      } else {
        navigation.getParent()?.navigate(route);
      }
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '夜班辛苦了'
    if (h < 12) return '早上好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}，{user?.name || '灯光师'} 👋</Text>
            <Text style={styles.roleTag}>{user?.role === 'admin' ? '🔑 管理员' : '🔧 维修工程师'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => Alert.alert('通知中心', '通知中心将在后续版本接入')}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Status Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="⚠️"
            label="待处理"
            value={summary.pending}
            color={colors.warning}
            onPress={() => navigation.navigate('Orders', { status: 'pending' })}
          />
          <StatCard
            icon="⚙️"
            label="处理中"
            value={summary.processing}
            color={colors.primary}
            onPress={() => navigation.navigate('Orders', { status: 'processing' })}
          />
          <StatCard
            icon="📋"
            label="待验收"
            value={summary.reviewing}
            color="#BC8CFF"
            onPress={() => navigation.navigate('Orders', { status: 'reviewing' })}
          />
          <StatCard
            icon="⏸️"
            label="已挂起"
            value={summary.suspended}
            color={colors.textSecondary}
            onPress={() => navigation.navigate('Orders', { status: 'suspended' })}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickCard}
                onPress={() => handleQuickAction(action.route)}
                activeOpacity={0.75}
              >
                <View style={[styles.quickIcon, { backgroundColor: action.color + '22' }]}>
                  <Text style={styles.quickIconEmoji}>{action.icon}</Text>
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Today's Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日提醒</Text>
          <View style={styles.reminderCard}>
            <Text style={styles.reminderIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>设备巡检提醒</Text>
              <Text style={styles.reminderDesc}>
                {todayInspections > 0 ? `今日到期巡检：${todayInspections} 项` : '今日暂无到期巡检计划'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reminderBtn}
              onPress={() => navigation.getParent()?.navigate('Records', {
                screen: 'RecordsList',
                params: { initialTab: 'inspections' },
              })}
            >
              <Text style={styles.reminderBtnText}>查看</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function StatCard({ icon, label, value, color, onPress }: {
  icon: string
  label: string
  value: number
  color: string
  onPress?: () => void
}) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.base,
  },
  greeting: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  roleTag: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4 },
  notificationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationIcon: { fontSize: 18 },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: fontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  // Sections
  section: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  // Quick Actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickIconEmoji: { fontSize: 20 },
  quickLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  // Reminder
  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderIcon: { fontSize: 24 },
  reminderTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  reminderDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  reminderBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  reminderBtnText: { fontSize: fontSize.xs, color: colors.white, fontWeight: '600' },
})
