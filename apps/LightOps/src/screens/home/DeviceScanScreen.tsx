import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { Camera, CameraType } from 'react-native-camera-kit'
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
  type PermissionStatus,
} from 'react-native-permissions'
import { devicesApi } from '../../api/devices.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import { getErrorMessage } from '../../utils/error'
import type { Device } from '../../types'

type CameraPermissionState = PermissionStatus | 'checking'
type LookupSource = 'manual' | 'scanner'
type ReadCodeEvent = { nativeEvent: { codeStringValue?: string } }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: colors.success },
  fault: { label: '故障', color: colors.danger },
  maintenance: { label: '维护中', color: colors.warning },
  offline: { label: '离线', color: colors.textMuted },
}

const cameraPermissionName = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
})

export function DeviceScanScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const scanLockedRef = useRef(false)
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [device, setDevice] = useState<Device | null>(null)
  const [scannerActive, setScannerActive] = useState(true)
  const [scanFeedback, setScanFeedback] = useState('对准设备二维码，识别后会自动查询台账。')
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>('checking')

  const requestCameraPermission = useCallback(async () => {
    if (!cameraPermissionName) {
      setCameraPermission(RESULTS.UNAVAILABLE)
      return
    }

    setCameraPermission('checking')

    try {
      const status = await check(cameraPermissionName)
      const nextStatus = status === RESULTS.DENIED
        ? await request(cameraPermissionName)
        : status
      setCameraPermission(nextStatus)
    } catch {
      setCameraPermission(RESULTS.UNAVAILABLE)
    }
  }, [])

  useEffect(() => {
    void requestCameraPermission()
  }, [requestCameraPermission])

  const lookupDevice = useCallback(async (rawValue: string, source: LookupSource) => {
    const value = rawValue.trim()
    if (!value) {
      if (source === 'manual') Alert.alert('提示', '请输入二维码内容或设备编号')
      return
    }

    setQrCode(value)
    setLoading(true)
    setDevice(null)
    if (source === 'scanner') setScanFeedback(`已识别：${value}`)

    try {
      const found = await devicesApi.getByQrCode(value)
      setDevice(found)
      setScannerActive(false)
      setScanFeedback('已匹配设备，可查看详情或直接创建工单。')
    } catch (error: unknown) {
      const message = getErrorMessage(error, '请检查二维码内容或设备编号')
      if (source === 'manual') {
        Alert.alert('未找到设备', message)
      } else {
        setScanFeedback(`未找到设备：${message}`)
      }
    } finally {
      setLoading(false)
      if (source === 'scanner') {
        setTimeout(() => {
          scanLockedRef.current = false
        }, 1200)
      }
    }
  }, [])

  const handleLookup = () => {
    void lookupDevice(qrCode, 'manual')
  }

  const handleReadCode = (event: ReadCodeEvent) => {
    const value = event.nativeEvent.codeStringValue?.trim()
    if (!value || scanLockedRef.current || loading || !scannerActive) return

    scanLockedRef.current = true
    void lookupDevice(value, 'scanner')
  }

  const handleResumeScan = () => {
    setDevice(null)
    setScannerActive(true)
    setScanFeedback('对准设备二维码，识别后会自动查询台账。')
    scanLockedRef.current = false
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

  const handleOpenSettings = () => {
    void openSettings().catch(() => {
      Alert.alert('提示', '无法打开系统设置，请手动开启相机权限。')
    })
  }

  const cameraGranted = cameraPermission === RESULTS.GRANTED || cameraPermission === RESULTS.LIMITED
  const cameraBlocked = cameraPermission === RESULTS.BLOCKED
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.scanPanel}>
          <View style={styles.cameraBox}>
            {cameraGranted ? (
              <Suspense fallback={<CameraLoading />}>
                <Camera
                  style={styles.camera}
                  cameraType={CameraType.Back}
                  scanBarcode={scannerActive && !loading}
                  showFrame
                  allowedBarcodeTypes={['qr']}
                  barcodeFrameSize={{ width: 250, height: 250 }}
                  laserColor={colors.primary}
                  frameColor={colors.white}
                  onReadCode={handleReadCode}
                />
              </Suspense>
            ) : (
              <CameraPermissionView
                status={cameraPermission}
                blocked={cameraBlocked}
                onRequest={requestCameraPermission}
                onOpenSettings={handleOpenSettings}
              />
            )}

            {cameraGranted && (
              <View style={styles.scanOverlay}>
                <Text style={styles.scanOverlayText}>{scanFeedback}</Text>
              </View>
            )}
          </View>

          <View style={styles.manualBox}>
            <Text style={styles.panelTitle}>设备二维码 / 编号</Text>
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
            <View style={styles.lookupRow}>
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
              {cameraGranted && (
                <TouchableOpacity
                  style={styles.resumeBtn}
                  onPress={handleResumeScan}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resumeBtnText}>继续扫描</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function CameraLoading() {
  return (
    <View style={styles.permissionBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.permissionTitle}>正在打开相机</Text>
    </View>
  )
}

function CameraPermissionView({
  status,
  blocked,
  onRequest,
  onOpenSettings,
}: {
  status: CameraPermissionState
  blocked: boolean
  onRequest: () => void
  onOpenSettings: () => void
}) {
  const checking = status === 'checking'
  const title = checking
    ? '正在检查相机权限'
    : blocked
      ? '相机权限已关闭'
      : '需要相机权限'
  const description = status === RESULTS.UNAVAILABLE
    ? '当前设备或系统环境暂不支持相机扫码。'
    : '开启相机权限后，可直接扫描设备二维码。'

  return (
    <View style={styles.permissionBox}>
      {checking ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={styles.permissionIcon}>▣</Text>
      )}
      <Text style={styles.permissionTitle}>{title}</Text>
      <Text style={styles.permissionText}>{description}</Text>
      {!checking && status !== RESULTS.UNAVAILABLE && (
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={blocked ? onOpenSettings : onRequest}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionBtnText}>{blocked ? '去系统设置' : '开启相机'}</Text>
        </TouchableOpacity>
      )}
    </View>
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
  scroll: { flex: 1 },
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
  content: { padding: spacing.base, paddingBottom: spacing.xl },
  scanPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cameraBox: {
    height: 330,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scanOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(5, 10, 20, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  scanOverlayText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  manualBox: {
    padding: spacing.lg,
  },
  panelTitle: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.md,
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
  lookupRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lookupBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnDisabled: { opacity: 0.7 },
  lookupBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  resumeBtn: {
    minWidth: 104,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  resumeBtnText: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  permissionIcon: { fontSize: 52, color: colors.primary, fontWeight: '800' },
  permissionTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  permissionBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
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
