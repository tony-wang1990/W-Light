import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { devicesApi } from '../../api/devices.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import { getErrorMessage } from '../../utils/error'
import type { Device } from '../../types'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: colors.success },
  fault: { label: '故障', color: colors.danger },
  maintenance: { label: '维护中', color: colors.warning },
  offline: { label: '离线', color: colors.textMuted },
}

export function DeviceScanScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [device, setDevice] = useState<Device | null>(null)

  const handleLookup = async () => {
    const value = qrCode.trim()
    if (!value) {
      Alert.alert('提示', '请输入二维码内容或设备编号')
      return
    }

    setLoading(true)
    setDevice(null)
    try {
      const found = await devicesApi.getByQrCode(value)
      setDevice(found)
    } catch (error: unknown) {
      Alert.alert('未找到设备', getErrorMessage(error, '请检查二维码内容或设备编号'))
    } finally {
      setLoading(false)
    }
  }

  const goDeviceDetail = () => {
    if (!device) return
    navigation.getParent()?.navigate('Records', {
      screen: 'DeviceDetail',
      params: { deviceId: device.id },
    })
  }

  const goCreateOrder = () => {
    if (!device) return
    navigation.getParent()?.navigate('Orders', {
      screen: 'OrderCreate',
      params: { deviceId: device.id },
    })
  }

  const status = device
    ? STATUS_LABEL[device.status] ?? { label: device.status, color: colors.textMuted }
    : null

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>扫码查验</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.scanPanel}>
          <View style={styles.scanIconBox}>
            <Text style={styles.scanIcon}>▣</Text>
          </View>
          <Text style={styles.panelTitle}>设备二维码</Text>
          <TextInput
            style={styles.input}
            value={qrCode}
            onChangeText={setQrCode}
            placeholder="输入二维码内容或设备编号"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleLookup}
          />
          <TouchableOpacity
            style={[styles.lookupBtn, loading && styles.lookupBtnDisabled]}
            onPress={handleLookup}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.lookupBtnText}>查询设备</Text>
            )}
          </TouchableOpacity>
        </View>

        {device && status && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>💡</Text>
              </View>
              <View style={styles.resultTitleBox}>
                <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                <Text style={styles.deviceNo}>{device.deviceNo}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            <InfoRow label="位置" value={device.location || '-'} />
            <InfoRow label="型号" value={[device.manufacturer, device.model].filter(Boolean).join(' ') || '-'} />
            <InfoRow label="二维码" value={device.qrCode || '-'} />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={goDeviceDetail}>
                <Text style={styles.secondaryBtnText}>查看详情</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={goCreateOrder}>
                <Text style={styles.primaryBtnText}>创建工单</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  topTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  topSpacer: { width: 54 },
  content: { flex: 1, padding: spacing.base },
  scanPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  scanIconBox: {
    width: 86,
    height: 86,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  scanIcon: { fontSize: 48, color: colors.primary, fontWeight: '800' },
  panelTitle: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  input: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  lookupBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnDisabled: { opacity: 0.7 },
  lookupBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  resultCard: {
    marginTop: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  deviceIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  deviceIconText: { fontSize: 24 },
  resultTitleBox: { flex: 1, minWidth: 0 },
  deviceName: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '800' },
  deviceNo: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3 },
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: '800' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  primaryBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
})
