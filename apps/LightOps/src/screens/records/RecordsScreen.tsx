import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { devicesApi } from '../../api/devices.api'
import { partsApi } from '../../api/parts.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import { Device, SparePart } from '../../types'

type TabKey = 'devices' | 'parts' | 'inspections'

const DEVICE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  normal:      { label: '正常', color: colors.success },
  fault:       { label: '故障', color: colors.danger },
  maintenance: { label: '维护中', color: colors.warning },
  offline:     { label: '离线', color: colors.textMuted },
}

const DEVICE_CATEGORY_ICON: Record<string, string> = {
  '灯具': '💡',
  '控台': '🎛️',
  '配电': '⚡',
  '音频': '🔊',
  '视频': '📹',
  '其他': '📦',
}

export function RecordsScreen() {
  const navigation = useNavigation<any>()
  const [tab, setTab] = useState<TabKey>('devices')
  const [keyword, setKeyword] = useState('')
  const [deviceStatus, setDeviceStatus] = useState<string>('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  // --- Devices Query ---
  const {
    data: devicesData,
    isLoading: devLoading,
    refetch: refetchDevices,
    isRefetching: devRefetching,
  } = useQuery({
    queryKey: ['devices', keyword, deviceStatus],
    queryFn: () => devicesApi.getList({ keyword, status: deviceStatus || undefined, pageSize: 50 }),
    enabled: tab === 'devices',
  })

  // --- Parts Query ---
  const {
    data: partsData,
    isLoading: partsLoading,
    refetch: refetchParts,
    isRefetching: partsRefetching,
  } = useQuery({
    queryKey: ['parts', keyword, lowStockOnly],
    queryFn: () => partsApi.getList({ keyword, lowStock: lowStockOnly || undefined, pageSize: 50 }),
    enabled: tab === 'parts',
  })

  const devices: Device[] = devicesData?.items ?? []
  const parts: SparePart[] = partsData?.items ?? []

  const onRefresh = useCallback(() => {
    if (tab === 'devices') refetchDevices()
    else if (tab === 'parts') refetchParts()
  }, [tab])

  const isLoading = tab === 'devices' ? devLoading : partsLoading
  const isRefreshing = tab === 'devices' ? devRefetching : partsRefetching

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>设备台账</Text>
        <Text style={styles.subtitle}>设备档案 · 备件库存 · 巡检计划</Text>
      </View>

      {/* Tab Switch */}
      <View style={styles.tabs}>
        {([
          { key: 'devices', label: '设备档案' },
          { key: 'parts',   label: '备件库' },
          { key: 'inspections', label: '巡检' },
        ] as { key: TabKey; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => { setTab(t.key); setKeyword('') }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={tab === 'devices' ? '搜索设备名称/编号...' : '搜索备件名称...'}
            placeholderTextColor={colors.textMuted}
          />
          {keyword !== '' && (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Device Status Filter */}
      {tab === 'devices' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm }}>
          {[
            { value: '', label: '全部' },
            { value: 'normal', label: '正常' },
            { value: 'fault', label: '故障' },
            { value: 'maintenance', label: '维护中' },
            { value: 'offline', label: '离线' },
          ].map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, deviceStatus === f.value && styles.filterChipActive]}
              onPress={() => setDeviceStatus(f.value)}
            >
              <Text style={[styles.filterChipText, deviceStatus === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Parts Low Stock Filter */}
      {tab === 'parts' && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, lowStockOnly && styles.filterChipWarn]}
            onPress={() => setLowStockOnly(!lowStockOnly)}
          >
            <Text style={[styles.filterChipText, lowStockOnly && { color: colors.warning }]}>
              ⚠️ 仅看低库存
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Devices List */}
      {tab === 'devices' && !isLoading && (
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <DeviceCard device={item} onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })} />}
          ListEmptyComponent={<EmptyState icon="💡" text="暂无设备" sub="该项目还没有录入设备档案" />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {/* Parts List */}
      {tab === 'parts' && !isLoading && (
        <FlatList
          data={parts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <PartCard part={item} />}
          ListEmptyComponent={<EmptyState icon="📦" text="备件库为空" sub="还没有录入备件信息" />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {/* Inspections Tab - Static placeholder with plan */}
      {tab === 'inspections' && (
        <InspectionsTab />
      )}
    </View>
  )
}

// ── Device Card ───────────────────────────────────────────────────────────────
function DeviceCard({ device, onPress }: { device: Device; onPress: () => void }) {
  const status = DEVICE_STATUS_LABEL[device.status] ?? { label: device.status, color: colors.textMuted }
  const icon = DEVICE_CATEGORY_ICON[device.category] ?? '📦'
  const health = device.healthScore ?? 100

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <View style={styles.deviceIcon}>
          <Text style={styles.deviceIconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.deviceNo}>编号：{device.deviceNo ?? '-'}</Text>
        <Text style={styles.deviceMeta} numberOfLines={1}>
          {device.location ?? '位置未录入'} · {device.model ?? device.category}
        </Text>

        {/* Health Score Bar */}
        <View style={styles.healthRow}>
          <View style={styles.healthBar}>
            <View style={[styles.healthFill, {
              width: `${health}%` as any,
              backgroundColor: health > 70 ? colors.success : health > 40 ? colors.warning : colors.danger,
            }]} />
          </View>
          <Text style={[styles.healthText, {
            color: health > 70 ? colors.success : health > 40 ? colors.warning : colors.danger,
          }]}>
            {health}分
          </Text>
        </View>
      </View>
      <Text style={styles.arrowIcon}>›</Text>
    </TouchableOpacity>
  )
}

// ── Part Card ─────────────────────────────────────────────────────────────────
function PartCard({ part }: { part: SparePart }) {
  const isLow = (part.stockQty ?? 0) <= (part.minStock ?? 5)

  return (
    <View style={[styles.card, isLow && styles.cardWarn]}>
      <View style={styles.partIconBox}>
        <Text style={styles.partIcon}>🔩</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.deviceName} numberOfLines={1}>{part.name}</Text>
          {isLow && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>库存不足</Text>
            </View>
          )}
        </View>
        <Text style={styles.deviceNo}>型号：{part.spec ?? '-'} · 位置：{part.location ?? '-'}</Text>
        <View style={styles.stockRow}>
          <Text style={styles.stockVal}>
            库存：<Text style={[styles.stockNum, isLow && { color: colors.warning }]}>
              {part.stockQty ?? 0}
            </Text> {part.unit ?? '个'}
          </Text>
          <Text style={styles.stockMin}>
            最低：{part.minStock ?? 0} {part.unit ?? '个'}
          </Text>
          {part.unitPrice && (
            <Text style={styles.stockPrice}>¥{part.unitPrice}/件</Text>
          )}
        </View>
      </View>
    </View>
  )
}

// ── Inspections Tab — 真实 API 联调版本 ──────────────────────────────────────
function InspectionsTab() {
  const [plans, setPlans] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { inspectionsApi } = await import('../../api/inspections.api')
      const data = await inspectionsApi.getPlans()
      setPlans(data)
    } catch (e) {
      console.error('InspectionsTab load failed', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  React.useEffect(() => { load() }, [])

  const handleRecord = async (planId: string) => {
    Alert.alert('提交巡检记录', '请选择巡检结果：', [
      { text: '取消', style: 'cancel' },
      {
        text: '✅ 正常',
        onPress: async () => {
          try {
            const { inspectionsApi } = await import('../../api/inspections.api')
            await inspectionsApi.createRecord(planId, 'normal', '巡检正常，无异常')
            Alert.alert('✅ 记录成功', '巡检记录已提交')
          } catch (e: any) { Alert.alert('错误', e.message) }
        },
      },
      {
        text: '⚠️ 有异常',
        style: 'destructive',
        onPress: async () => {
          try {
            const { inspectionsApi } = await import('../../api/inspections.api')
            await inspectionsApi.createRecord(planId, 'abnormal', '巡检发现异常，需处理')
            Alert.alert('⚠️ 记录成功', '异常巡检记录已提交，请跟进处理')
          } catch (e: any) { Alert.alert('错误', e.message) }
        },
      },
    ])
  }

  const FREQ_LABELS: Record<string, string> = {
    daily: '📅 每日', weekly: '📆 每周', monthly: '🗓 每月',
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <Text style={styles.sectionTitle}>巡检计划（{plans.length} 个）</Text>
      {plans.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>暂无巡检计划，请在网页端创建</Text>
        </View>
      )}
      {plans.map((p, i) => (
        <View key={p.id || i} style={[styles.inspectionCard]}>
          <View style={styles.inspectionLeft}>
            <Text style={styles.inspectionIcon}>📋</Text>
          </View>
          <View style={styles.inspectionBody}>
            <Text style={styles.inspectionName}>{p.name}</Text>
            <Text style={styles.inspectionMeta}>频率：{FREQ_LABELS[p.frequency] ?? p.frequency}</Text>
            {p.nextInspectionAt && (
              <Text style={styles.inspectionNext}>
                下次：{new Date(p.nextInspectionAt).toLocaleDateString('zh-CN')}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.inspectionBtn} onPress={() => handleRecord(p.id)}>
            <Text style={styles.inspectionBtnText}>记录</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.white, fontWeight: '700' },

  // Search
  searchRow: { paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  clearBtn: { color: colors.textMuted, fontSize: 14 },

  // Filters
  filterRow: { flexGrow: 0, marginBottom: spacing.sm, paddingHorizontal: spacing.base },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipWarn: { backgroundColor: colors.warning + '22', borderColor: colors.warning },
  filterChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  filterChipTextActive: { color: colors.white, fontWeight: '600' },

  // List
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 80 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWarn: { borderColor: colors.warning + '55' },
  cardLeft: { marginRight: spacing.md },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },

  // Device
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconText: { fontSize: 22 },
  deviceName: { flex: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginRight: spacing.sm },
  deviceNo: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  deviceMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs },

  // Health bar
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  healthBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  healthFill: { height: '100%', borderRadius: radius.full },
  healthText: { fontSize: 10, fontWeight: '700', minWidth: 32, textAlign: 'right' },

  // Status badge
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  arrowIcon: { fontSize: 20, color: colors.textMuted, marginLeft: spacing.sm },

  // Parts
  partIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  partIcon: { fontSize: 22 },
  lowStockBadge: {
    backgroundColor: colors.warning + '22',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowStockText: { fontSize: 10, color: colors.warning, fontWeight: '700' },
  stockRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: 4 },
  stockVal: { fontSize: fontSize.xs, color: colors.textSecondary },
  stockNum: { fontWeight: '700', color: colors.textPrimary },
  stockMin: { fontSize: fontSize.xs, color: colors.textMuted },
  stockPrice: { fontSize: fontSize.xs, color: colors.primary },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },

  // Inspections
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inspectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inspectionCardToday: { borderColor: colors.warning + '88' },
  inspectionLeft: { marginRight: spacing.md },
  inspectionIcon: { fontSize: 28 },
  inspectionBody: { flex: 1 },
  inspectionName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  inspectionMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  inspectionNext: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  inspectionBtn: {
    backgroundColor: colors.primary + '22',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inspectionBtnText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },

  recordRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  recordBody: { flex: 1 },
  recordName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  recordMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
})
