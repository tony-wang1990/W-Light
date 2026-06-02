import React, { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '../../api/devices.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import { getErrorMessage } from '../../utils/error'

const DEVICE_CATEGORIES = ['灯具', '控台', '配电', '音频', '视频', '其他']

function generateDeviceNo() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const seq = Math.floor(1000 + Math.random() * 9000)
  return `DEV-${date}-${seq}`
}

export function DeviceCreateScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const queryClient = useQueryClient()
  const defaultDeviceNo = useMemo(() => generateDeviceNo(), [])
  const [deviceNo, setDeviceNo] = useState(defaultDeviceNo)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('灯具')
  const [location, setLocation] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [qrCode, setQrCode] = useState(defaultDeviceNo)
  const [saving, setSaving] = useState(false)

  const handleDeviceNoChange = (value: string) => {
    setDeviceNo(value)
    if (!qrCode || qrCode === deviceNo) setQrCode(value)
  }

  const handleSubmit = async () => {
    if (!deviceNo.trim()) {
      Alert.alert('提示', '请输入设备编号')
      return
    }
    if (!name.trim()) {
      Alert.alert('提示', '请输入设备名称')
      return
    }

    setSaving(true)
    try {
      const created = await devicesApi.create({
        deviceNo: deviceNo.trim(),
        name: name.trim(),
        category,
        location: location.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        qrCode: qrCode.trim() || deviceNo.trim(),
        status: 'normal',
        healthScore: 100,
      })
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      Alert.alert('已新增设备', '设备已写入台账，可以继续报修或查看详情。', [
        { text: '返回台账', onPress: () => navigation.goBack() },
        {
          text: '查看详情',
          onPress: () => navigation.navigate('DeviceDetail', { deviceId: created.id }),
        },
      ])
    } catch (error: unknown) {
      Alert.alert('保存失败', getErrorMessage(error, '请检查设备编号或网络连接'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>新增设备</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Field label="设备编号" value={deviceNo} onChangeText={handleDeviceNoChange} required />
          <Field label="设备名称" value={name} onChangeText={setName} placeholder="例如：主舞台光束灯 01" required />
          <Text style={styles.label}>设备分类</Text>
          <View style={styles.categoryGrid}>
            {DEVICE_CATEGORIES.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.categoryChip, category === item && styles.categoryChipActive]}
                onPress={() => setCategory(item)}
              >
                <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="安装位置" value={location} onChangeText={setLocation} placeholder="例如：A区主舞台左侧桁架" />
          <Field label="品牌/厂商" value={manufacturer} onChangeText={setManufacturer} placeholder="例如：MA / Martin" />
          <Field label="型号" value={model} onChangeText={setModel} placeholder="例如：Viper Profile" />
          <Field label="二维码内容" value={qrCode} onChangeText={setQrCode} placeholder="默认使用设备编号" />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>保存设备</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
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
  content: { padding: spacing.base, paddingBottom: 80 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  categoryText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  categoryTextActive: { color: colors.primary },
  submitBtn: {
    marginTop: spacing.base,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: colors.white, fontSize: fontSize.md, fontWeight: '800' },
})
