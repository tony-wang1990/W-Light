import React from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { devicesApi } from '../../api/devices.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { RecordsStackParamList } from '../../navigation/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal:      { label: '正常', color: colors.success },
  fault:       { label: '故障', color: colors.danger },
  maintenance: { label: '维护中', color: colors.warning },
  offline:     { label: '离线', color: colors.textMuted },
}

export function DeviceDetailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const route = useRoute<RouteProp<RecordsStackParamList, 'DeviceDetail'>>()
  const { deviceId } = route.params

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => devicesApi.getById(deviceId),
  })

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>设备不存在</Text>
      </View>
    )
  }

  const status = STATUS_MAP[device.status] ?? { label: device.status, color: colors.textMuted }
  const health = device.healthScore ?? 100
  const healthColor = health > 70 ? colors.success : health > 40 ? colors.warning : colors.danger
  const healthWidth = `${Math.max(0, Math.min(100, health))}%` as `${number}%`

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>设备详情</Text>
        <TouchableOpacity onPress={() => Alert.alert('提示', '报修功能将在工单创建页开启')}>
          <Text style={styles.reportBtn}>🔧 报修</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Text style={styles.heroIcon}>💡</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{device.name}</Text>
            <Text style={styles.heroNo}>编号：{device.deviceNo ?? '-'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
        </View>

        {/* Health Score */}
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Text style={styles.healthLabel}>健康评分</Text>
            <Text style={[styles.healthScore, { color: healthColor }]}>{health}分</Text>
          </View>
          <View style={styles.healthBarBg}>
            <View style={[styles.healthBarFill, {
              width: healthWidth,
              backgroundColor: healthColor,
            }]} />
          </View>
          <Text style={styles.healthHint}>
            {health > 70 ? '✅ 设备状态良好' : health > 40 ? '⚠️ 建议安排保养' : '🚨 建议立即维修'}
          </Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <InfoRow label="设备类别" value={device.category ?? '-'} />
          <InfoRow label="品牌型号" value={[device.manufacturer, device.model].filter(Boolean).join(' ') || '-'} />
          <InfoRow label="安装位置" value={device.location ?? '-'} />
          <InfoRow label="DMX地址" value={device.dmxAddress ? `${device.dmxAddress}ch` : '-'} />
          <InfoRow label="额定功率" value={device.power ? `${device.power}W` : '-'} />
          <InfoRow label="安装日期" value={device.installDate ?? '-'} />
          <InfoRow label="保修到期" value={device.warrantyExpire ?? '-'} />
        </View>

        {/* QR Code info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>二维码 & 编号</Text>
          <View style={styles.qrBox}>
            <Text style={styles.qrIcon}>📱</Text>
            <View>
              <Text style={styles.qrCode}>{device.qrCode ?? '-'}</Text>
              <Text style={styles.qrHint}>长按可复制二维码内容</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.getParent()?.navigate('Orders', {
              screen: 'OrderCreate',
              params: { deviceId: device.id },
            })}
          >
            <Text style={styles.actionBtnIcon}>📋</Text>
            <Text style={styles.actionBtnText}>报修工单</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.getParent()?.navigate('Orders', {
              screen: 'OrderList',
              params: { deviceId: device.id, title: '维修历史' },
            })}
          >
            <Text style={styles.actionBtnIcon}>📈</Text>
            <Text style={styles.actionBtnText}>维修历史</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>🗂️</Text>
            <Text style={styles.actionBtnText}>操作手册</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSize.md, color: colors.textMuted },

  topBar: {
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
  topTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  reportBtn: { fontSize: fontSize.sm, color: colors.danger, fontWeight: '600' },

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.base,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { fontSize: 36 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: fontSize.lg, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  heroNo: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  statusBadge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700' },

  // Health
  healthCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  healthLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  healthScore: { fontSize: fontSize.xxl, fontWeight: '800' },
  healthBarBg: {
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  healthBarFill: { height: '100%', borderRadius: radius.full },
  healthHint: { fontSize: fontSize.xs, color: colors.textSecondary },

  // Section
  section: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  // QR
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  qrIcon: { fontSize: 40 },
  qrCode: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary, fontFamily: 'monospace' },
  qrHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  actionBtnIcon: { fontSize: 24 },
  actionBtnText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
})
