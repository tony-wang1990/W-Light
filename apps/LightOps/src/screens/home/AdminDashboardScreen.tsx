import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { reportsApi, type OperationsSummary, type EngineerPerformance, type FaultStat } from '../../api/reports.api'
import { colors, spacing, fontSize, radius } from '../../theme'

function getStartOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function AdminDashboardScreen() {
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  const [performance, setPerformance] = useState<EngineerPerformance[]>([])
  const [faults, setFaults] = useState<FaultStat[]>([])

  const loadData = async () => {
    try {
      const start = getStartOfMonth()
      const end = getToday()
      const [sumRes, perfRes, faultRes] = await Promise.all([
        reportsApi.operationsSummary(start, end).catch(() => null),
        reportsApi.engineerPerformance(start, end).catch(() => []),
        reportsApi.faultAnalysis(1).catch(() => ({ stats: [] }))
      ])
      
      if (sumRes) setSummary(sumRes)
      if (perfRes) setPerformance(perfRes)
      if (faultRes && faultRes.stats) setFaults(faultRes.stats.slice(0, 5))
    } catch (err) {
      console.warn('Failed to load admin dashboard', err)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据驾驶舱 (本月)</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Core KPIs */}
        <Text style={styles.sectionTitle}>大盘指标</Text>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.kpiLabel}>总报修</Text>
            <Text style={styles.kpiValue}>{summary?.newOrders || 0}</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.kpiLabel}>已完工</Text>
            <Text style={styles.kpiValue}>{summary?.closedOrders || 0}</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.danger }]}>
            <Text style={styles.kpiLabel}>超时预警</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>{summary?.overtimeOrders || 0}</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.warning }]}>
            <Text style={styles.kpiLabel}>累计花销</Text>
            <Text style={styles.kpiValue}>¥{summary?.totalRepairCost?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        {/* Engineer Performance */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>团队负载监控</Text>
        <View style={styles.card}>
          {performance.length === 0 ? (
            <Text style={styles.emptyText}>暂无绩效数据</Text>
          ) : (
            performance.map(p => (
              <View key={p.id} style={styles.perfRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perfName}>{p.name} {p.role === 'admin' ? '(管理)' : ''}</Text>
                  <Text style={styles.perfStats}>
                    工单: {p.totalClosed}/{p.totalAssigned} | 超时: <Text style={{ color: p.overtimeCount > 0 ? colors.danger : colors.textSecondary }}>{p.overtimeCount}</Text>
                  </Text>
                </View>
                <View style={styles.perfBarContainer}>
                  <View style={[
                    styles.perfBar, 
                    { width: `${p.totalAssigned > 0 ? (p.totalClosed / p.totalAssigned) * 100 : 0}%` }
                  ]} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Top Faults */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>本月频发故障排雷</Text>
        <View style={styles.card}>
          {faults.length === 0 ? (
            <Text style={styles.emptyText}>暂无故障数据</Text>
          ) : (
            faults.map((f, idx) => (
              <View key={idx} style={styles.faultRow}>
                <View style={styles.faultRank}><Text style={styles.faultRankText}>{idx + 1}</Text></View>
                <Text style={styles.faultName}>{f.faultType || '未知类型'}</Text>
                <Text style={styles.faultCount}>{f.count} 次</Text>
              </View>
            ))
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.sm, marginRight: spacing.sm, marginLeft: -spacing.sm },
  backBtnText: { fontSize: 24, color: colors.textPrimary },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  scrollContent: { padding: spacing.base },
  
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  kpiValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', padding: spacing.md },
  
  perfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  perfName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  perfStats: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  perfBarContainer: { width: 80, height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
  perfBar: { height: '100%', backgroundColor: colors.success },

  faultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  faultRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.danger + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  faultRankText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: 'bold' },
  faultName: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  faultCount: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
})
