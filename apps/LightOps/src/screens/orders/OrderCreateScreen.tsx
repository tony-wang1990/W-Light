import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { uploadApi, type UploadedMedia } from '../../api/upload.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import { getErrorMessage } from '../../utils/error'
import type { OrdersStackParamList } from '../../navigation/types'

const CATEGORIES = ['故障维修', '定期保养', '设备安装', '紧急抢修']
const PRIORITIES = [
  { label: 'P0 紧急（≤2h）', value: 'P0', color: '#FF3B30' },
  { label: 'P1 高（≤8h）', value: 'P1', color: '#FF9500' },
  { label: 'P2 中（≤24h）', value: 'P2', color: '#007AFF' },
  { label: 'P3 低（≤7天）', value: 'P3', color: '#8B949E' },
]
const FAULT_TYPES = [
  '不亮', '频闪', '不受控', '颜色异常', '机构卡死', '漏电', '物理损坏', '网络故障', '其他'
]

export function OrderCreateScreen() {
  const navigation = useNavigation<NavigationProp<OrdersStackParamList>>()
  const route = useRoute<RouteProp<OrdersStackParamList, 'OrderCreate'>>()
  const deviceId = route.params?.deviceId
  const [category, setCategory] = useState(route.params?.category || '故障维修')
  const [priority, setPriority] = useState('P2')
  const [faultType, setFaultType] = useState(route.params?.faultType || '')
  const [faultDesc, setFaultDesc] = useState(route.params?.initialFaultDesc || '')
  const [locationDesc, setLocationDesc] = useState('')
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handlePickMedia = async () => {
    setUploading(true)
    try {
      const uploaded = await uploadApi.pickAndUpload('mixed')
      if (uploaded.length > 0) setMedia(prev => [...prev, ...uploaded])
    } catch (error: unknown) {
      Alert.alert('上传失败', getErrorMessage(error, '请检查网络或文件大小'))
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveMedia = (url: string) => {
    setMedia(prev => prev.filter(item => item.url !== url))
  }

  const handleSubmit = async () => {
    if (!faultDesc.trim()) {
      Alert.alert('提示', '请填写故障描述')
      return
    }
    if (faultDesc.length < 10) {
      Alert.alert('提示', '故障描述不少于10个字符，请详细描述')
      return
    }

    setSubmitting(true)
    try {
      const order = await ordersApi.create({
        category,
        deviceId,
        priority,
        faultType: faultType || undefined,
        faultDesc: faultDesc.trim(),
        mediaUrls: media.map(item => item.url),
        locationDesc: locationDesc.trim() || undefined,
        faultAt: new Date().toISOString(),
      })
      Alert.alert('✅ 工单已创建', `工单号：${order.orderNo}\n已提交，等待管理员派单`, [
        { text: '查看工单', onPress: () => navigation.navigate('OrderDetail', { orderId: order.id }) },
        { text: '返回列表', onPress: () => navigation.goBack() },
      ])
    } catch (e: unknown) {
      Alert.alert('创建失败', getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新建工单</Text>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>提交</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>工单类型</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>优先级</Text>
          <View style={styles.priorityGrid}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityCard,
                  priority === p.value && { borderColor: p.color, backgroundColor: p.color + '22' },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text style={[
                  styles.priorityLabel,
                  priority === p.value && { color: p.color, fontWeight: '700' },
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fault Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>故障类型 <Text style={styles.optional}>（可选）</Text></Text>
          <View style={styles.chipRow}>
            {FAULT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, faultType === t && styles.chipActive]}
                onPress={() => setFaultType(faultType === t ? '' : t)}
              >
                <Text style={[styles.chipText, faultType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fault Description */}
        {deviceId && (
          <View style={styles.deviceHint}>
            <Text style={styles.deviceHintText}>已关联扫码设备，提交后工单会进入该设备维修历史。</Text>
          </View>
        )}

        {/* Fault Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            故障描述 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            value={faultDesc}
            onChangeText={setFaultDesc}
            placeholder="请详细描述故障现象、发生时间、已尝试的处理方式等（不少于10字）"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{faultDesc.length}/500</Text>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>故障位置 <Text style={styles.optional}>（可选）</Text></Text>
          <TextInput
            style={styles.inputSingle}
            value={locationDesc}
            onChangeText={setLocationDesc}
            placeholder="如：主舞台上方 3 号摇头灯排 第 5 台"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Media Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>现场照片/视频 <Text style={styles.optional}>（可选）</Text></Text>
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
            onPress={handlePickMedia}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.uploadBtnText}>+ 选择并上传附件</Text>
            )}
          </TouchableOpacity>
          {media.map(item => (
            <View key={item.url} style={styles.mediaRow}>
              <Text style={styles.mediaName} numberOfLines={1}>
                {item.mediaType === 'video' ? '🎬' : '🖼️'} {item.name}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveMedia(item.url)}>
                <Text style={styles.mediaRemove}>移除</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: { fontSize: fontSize.md, color: colors.textSecondary },
  headerTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  body: { flex: 1 },
  section: { paddingHorizontal: spacing.base, paddingTop: spacing.base },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  required: { color: colors.danger },
  optional: { color: colors.textMuted, fontWeight: '400' },
  deviceHint: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    backgroundColor: colors.primary + '18',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  deviceHintText: { fontSize: fontSize.xs, color: colors.primary, lineHeight: 18 },
  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  // Priority Grid
  priorityGrid: { gap: spacing.sm },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  // Text Area
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
  // Single Input
  inputSingle: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  uploadBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
  },
  uploadBtnText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mediaName: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
  mediaRemove: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700', marginLeft: spacing.sm },
})
