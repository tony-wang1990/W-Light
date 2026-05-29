import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, FlatList, TextInput,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { ordersApi } from '../../api/orders.api'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityTag } from '../../components/common/PriorityTag'
import { OrderCard } from '../../components/order/OrderCard'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { WorkOrder } from '../../types'

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '待验收', value: 'reviewing' },
  { label: '已完成', value: 'closed' },
]

export function OrderListScreen() {
  const navigation = useNavigation<any>()
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const fetchOrders = useCallback(async (status = '', kw = '', pg = 1, reset = false) => {
    if (loading && !reset) return
    setLoading(true)
    try {
      const result = await ordersApi.list({
        status: status || undefined,
        keyword: kw || undefined,
        page: pg,
        pageSize: 20,
      })
      if (reset || pg === 1) {
        setOrders(result.items)
      } else {
        setOrders(prev => [...prev, ...result.items])
      }
      setTotal(result.total)
    } catch (e) {
      // Handle error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading])

  React.useEffect(() => {
    fetchOrders(selectedStatus, keyword, 1, true)
  }, [selectedStatus])

  const handleRefresh = () => {
    setRefreshing(true)
    setPage(1)
    fetchOrders(selectedStatus, keyword, 1, true)
  }

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
    setPage(1)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>工单管理</Text>
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
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, selectedStatus === f.value && styles.filterChipActive]}
            onPress={() => handleStatusFilter(f.value)}
          >
            <Text
              style={[styles.filterLabel, selectedStatus === f.value && styles.filterLabelActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>共 {total} 条工单</Text>
      </View>

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
