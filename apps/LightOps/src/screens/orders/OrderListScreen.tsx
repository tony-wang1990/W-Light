import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, FlatList, TextInput,
} from 'react-native'
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { OrderCard } from '../../components/order/OrderCard'
import { OfflineCacheBanner } from '../../components/common/OfflineCacheBanner'
import { takeLastOfflineCacheHit, type OfflineCacheHit } from '../../offline/offlineCache'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { WorkOrder } from '../../types'
import type { OrdersStackParamList } from '../../navigation/types'

const STATUS_FILTERS = [
  { label: '全部', value: '', countKey: 'total' },
  { label: '待处理', value: 'pending,assigned', countKey: 'pending' },
  { label: '处理中', value: 'processing,suspended', countKey: 'processing' },
  { label: '待验收', value: 'reviewing', countKey: 'reviewing' },
  { label: '已完成', value: 'closed,rejected', countKey: 'closed' },
]

export function OrderListScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const route = useRoute<RouteProp<OrdersStackParamList, 'OrderList'>>()
  const routeDeviceId = route.params?.deviceId
  const routeTitle = route.params?.title
  const routeStatus = route.params?.status ?? ''
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(routeStatus)
  const [keyword, setKeyword] = useState('')
  const [offlineCacheHit, setOfflineCacheHit] = useState<OfflineCacheHit | null>(null)

  React.useEffect(() => {
    setSelectedStatus(routeStatus)
  }, [routeStatus])

  const fetchOrders = useCallback(async (status = '', kw = '', pg = 1, reset = false) => {
    if (loading && !reset) return
    setLoading(true)
    try {
      const result = await ordersApi.list({
        status: status || undefined,
        deviceId: routeDeviceId,
        keyword: kw || undefined,
        page: pg,
        pageSize: 20,
      })
      setOfflineCacheHit(takeLastOfflineCacheHit('/orders'))
      if (reset || pg === 1) {
        setOrders(result.items)
      } else {
        setOrders(prev => [...prev, ...result.items])
      }
      setTotal(result.total)
    } catch {
      // 首页统计和下拉刷新会保留当前列表，后续统一接入 toast 提醒。
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading, routeDeviceId])

  const fetchSummary = useCallback(async () => {
    if (routeDeviceId) return
    try {
      const data = await ordersApi.summary()
      setSummary(data)
    } catch {
      setSummary({})
    }
  }, [routeDeviceId])

  React.useEffect(() => {
    fetchOrders(selectedStatus, keyword, 1, true)
    fetchSummary()
  }, [selectedStatus, routeDeviceId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchSummary()
    fetchOrders(selectedStatus, keyword, 1, true)
  }

  const getFilterCount = (countKey: string) => {
    if (countKey === 'total') {
      return Object.values(summary).reduce((sum, value) => sum + Number(value || 0), 0)
    }
    if (countKey === 'pending') {
      return Number(summary.pending || 0) + Number(summary.assigned || 0)
    }
    if (countKey === 'processing') {
      return Number(summary.processing || 0) + Number(summary.suspended || 0)
    }
    if (countKey === 'closed') {
      return Number(summary.closed || 0) + Number(summary.rejected || 0)
    }
    return Number(summary[countKey] || 0)
  }

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{routeTitle || '工单管理'}</Text>
          {routeDeviceId && <Text style={styles.headerSubTitle}>设备维修历史</Text>}
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('OrderCreate')}
        >
          <Text style={styles.createButtonText}>+ 报修</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索工单号、故障描述..."
          placeholderTextColor={colors.textMuted}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => fetchOrders(selectedStatus, keyword, 1, true)}
          returnKeyType="search"
        />
      </View>

      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(f => {
          const count = routeDeviceId ? null : getFilterCount(f.countKey)
          return (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, selectedStatus === f.value && styles.filterChipActive]}
            onPress={() => handleStatusFilter(f.value)}
          >
            <Text
              style={[styles.filterLabel, selectedStatus === f.value && styles.filterLabelActive]}
            >
              {f.label}{count !== null ? ` ${count}` : ''}
            </Text>
          </TouchableOpacity>
        )})}
      </ScrollView>

      {/* Results count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>共 {total} 条工单</Text>
      </View>

      {offlineCacheHit && (
        <OfflineCacheBanner
          cachedAt={offlineCacheHit.cachedAt}
          title="正在显示工单离线缓存"
        />
      )}

      {/* Order List */}
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>暂无工单</Text>
              <Text style={styles.emptyDesc}>点击右上角「报修」创建新工单</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  headerSubTitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  createButtonText: { color: colors.white, fontWeight: '600', fontSize: fontSize.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  filterRow: { flexGrow: 0 },
  filterContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  filterLabelActive: { color: colors.white },
  countRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.xs },
  countText: { fontSize: fontSize.xs, color: colors.textMuted },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.base },
  emptyTitle: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  emptyDesc: { fontSize: fontSize.sm, color: colors.textMuted },
})
