import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { partsApi } from '../../api/parts.api'
import { uploadApi, type UploadedMedia } from '../../api/upload.api'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { SparePart } from '../../types'
import type { OrdersStackParamList } from '../../navigation/types'
import { getErrorMessage } from '../../utils/error'
import { enqueueOfflineRequest, isLikelyOfflineError } from '../../offline/offlineQueue'

const STEP_TYPES = ['故障确认', '拆机检查', '更换配件', '参数调试', '功能测试', '恢复安装', '外委处理', '其他']

const getMediaKey = (item: UploadedMedia) => item.url || item.localUri || item.name
const getUploadedUrls = (items: UploadedMedia[]) =>
  items.map(item => item.url).filter((url): url is string => Boolean(url))
const getPendingMedia = (items: UploadedMedia[]) =>
  items.filter(item => item.pendingUpload && item.localUri)

interface PartUsageDraft {
  partId: string
  name: string
  quantity: number
  unit: string
}

export function OrderRepairScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<OrdersStackParamList, 'OrderRepair'>>()
  const { orderId } = route.params

  const [stepType, setStepType] = useState('故障确认')
  const [stepDesc, setStepDesc] = useState('')
  const [outsourceVendor, setOutsourceVendor] = useState('')
  const [outsourceCost, setOutsourceCost] = useState('')
  const [parts, setParts] = useState<SparePart[]>([])
  const [selectedPartId, setSelectedPartId] = useState('')
  const [partQuantity, setPartQuantity] = useState('1')
  const [partUsages, setPartUsages] = useState<PartUsageDraft[]>([])
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    partsApi.getList({ pageSize: 100 })
      .then(res => setParts(res.items))
      .catch(error => console.warn('Failed to load parts', error))
  }, [])

  const handleAddPartUsage = () => {
    const part = parts.find(item => item.id === selectedPartId)
    const quantity = Number(partQuantity)
    if (!part) {
      Alert.alert('提示', '请选择要消耗的备件')
      return
    }
    if (!quantity || quantity <= 0) {
      Alert.alert('提示', '请输入正确的备件数量')
      return
    }
    if (Number(part.stock) < quantity) {
      Alert.alert('库存不足', `当前库存 ${part.stock} ${part.unit}`)
      return
    }

    setPartUsages(prev => {
      const existing = prev.find(item => item.partId === part.id)
      if (existing) {
        return prev.map(item =>
          item.partId === part.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }

      return [
        ...prev,
        {
          partId: part.id,
          name: part.name,
          quantity,
          unit: part.unit || '个',
        },
      ]
    })
    setSelectedPartId('')
    setPartQuantity('1')
  }

  const handleRemovePartUsage = (partId: string) => {
    setPartUsages(prev => prev.filter(item => item.partId !== partId))
  }

  const handlePickMedia = async () => {
    setUploading(true)
    try {
      const uploaded = await uploadApi.pickAndUpload('mixed')
      if (uploaded.length > 0) setMedia(prev => [...prev, ...uploaded])
      if (uploaded.some(item => item.pendingUpload)) {
        Alert.alert('附件已暂存', '部分附件暂未上传，将在提交或离线同步时自动重试。')
      }
    } catch (error: unknown) {
      Alert.alert('上传失败', getErrorMessage(error, '请检查网络或文件大小'))
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveMedia = (key: string) => {
    setMedia(prev => prev.filter(item => getMediaKey(item) !== key))
  }

  const handleSubmit = async () => {
    if (!stepDesc.trim() || stepDesc.length < 5) {
      Alert.alert('提示', '请填写维修步骤描述（不少于5字）')
      return
    }

    setSubmitting(true)
    let preparedMedia = media

    try {
      preparedMedia = await uploadApi.uploadPendingMedia(media)
      setMedia(preparedMedia)
      const payload = {
        stepType,
        stepDesc: stepDesc.trim(),
        photoUrls: getUploadedUrls(preparedMedia),
        outsourceVendor: outsourceVendor.trim() || undefined,
        outsourceCost: outsourceCost ? Number(outsourceCost) : undefined,
        partUsages: partUsages.map(item => ({
          partId: item.partId,
          quantity: item.quantity,
          note: `${stepType}消耗`,
        })),
      }
      await ordersApi.addRepairLog(orderId, payload)
      Alert.alert('✅ 记录已保存', '维修步骤已添加', [
        { text: '继续添加', onPress: () => {
          setStepDesc('')
          setOutsourceVendor('')
          setOutsourceCost('')
          setPartUsages([])
          setMedia([])
        }},
        { text: '返回工单', onPress: () => navigation.goBack() },
      ])
    } catch (e: unknown) {
      if (isLikelyOfflineError(e)) {
        const payload = {
          stepType,
          stepDesc: stepDesc.trim(),
          photoUrls: getUploadedUrls(preparedMedia),
          outsourceVendor: outsourceVendor.trim() || undefined,
          outsourceCost: outsourceCost ? Number(outsourceCost) : undefined,
          partUsages: partUsages.map(item => ({
            partId: item.partId,
            quantity: item.quantity,
            note: `${stepType}消耗`,
          })),
        }
        enqueueOfflineRequest({
          type: 'add-repair-log',
          title: `维修记录：${stepType}`,
          endpoint: `/orders/${orderId}/repair-logs`,
          method: 'post',
          body: payload,
          pendingMedia: getPendingMedia(preparedMedia),
          attachmentField: 'photoUrls',
        })
        Alert.alert('已离线保存', '当前网络不可用，维修记录已进入加密同步队列；恢复网络后可在“我的”页面手动同步。', [
          { text: '返回工单', onPress: () => navigation.goBack() },
        ])
        return
      }

      Alert.alert('保存失败', getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加维修记录</Text>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Step Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>操作类型</Text>
          <View style={styles.chipRow}>
            {STEP_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, stepType === t && styles.chipActive]}
                onPress={() => setStepType(t)}
              >
                <Text style={[styles.chipText, stepType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>操作描述 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textArea}
            value={stepDesc}
            onChangeText={setStepDesc}
            placeholder="描述本次操作的具体内容、使用的工具、发现的问题等..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{stepDesc.length}/500</Text>
        </View>

        {/* Outsource (only when stepType === '外委处理') */}
        {stepType === '外委处理' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>外委信息</Text>
            <TextInput
              style={[styles.inputSingle, { marginBottom: spacing.sm }]}
              value={outsourceVendor}
              onChangeText={setOutsourceVendor}
              placeholder="外委厂商名称"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.costRow}>
              <TextInput
                style={[styles.inputSingle, { flex: 1 }]}
                value={outsourceCost}
                onChangeText={setOutsourceCost}
                placeholder="外委费用"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.costUnit}>元</Text>
            </View>
          </View>
        )}

        {/* Parts Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>更换备件 <Text style={styles.optional}>（可选，保存后自动扣库存）</Text></Text>
          {parts.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partPicker}>
                {parts.map(part => (
                  <TouchableOpacity
                    key={part.id}
                    style={[styles.partChip, selectedPartId === part.id && styles.partChipActive]}
                    onPress={() => setSelectedPartId(part.id)}
                  >
                    <Text style={[styles.partChipName, selectedPartId === part.id && styles.partChipTextActive]} numberOfLines={1}>
                      {part.name}
                    </Text>
                    <Text style={[styles.partChipStock, selectedPartId === part.id && styles.partChipTextActive]}>
                      库存 {part.stock}{part.unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.partAddRow}>
                <TextInput
                  style={styles.partQtyInput}
                  value={partQuantity}
                  onChangeText={setPartQuantity}
                  placeholder="数量"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.partAddBtn} onPress={handleAddPartUsage}>
                  <Text style={styles.partAddBtnText}>加入消耗</Text>
                </TouchableOpacity>
              </View>
              {partUsages.map(item => (
                <View key={item.partId} style={styles.usageRow}>
                  <Text style={styles.usageText}>{item.name} × {item.quantity}{item.unit}</Text>
                  <TouchableOpacity onPress={() => handleRemovePartUsage(item.partId)}>
                    <Text style={styles.usageRemove}>移除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptyPartText}>暂无备件数据，可先保存维修记录，后续在备件库补录。</Text>
          )}
        </View>

        {/* Media Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>维修照片/视频 <Text style={styles.optional}>（可选）</Text></Text>
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
            <View key={getMediaKey(item)} style={styles.mediaRow}>
              <Text style={styles.mediaName} numberOfLines={1}>
                {item.mediaType === 'video' ? '🎬' : '🖼️'} {item.pendingUpload ? '[待上传] ' : ''}{item.name}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveMedia(getMediaKey(item))}>
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
  submitBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  body: { flex: 1 },
  section: { paddingHorizontal: spacing.base, paddingTop: spacing.base },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  required: { color: colors.danger },
  optional: { color: colors.textMuted, fontWeight: '400' },
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
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
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
  costRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  costUnit: { fontSize: fontSize.md, color: colors.textMuted },
  partPicker: { marginBottom: spacing.sm },
  partChip: {
    width: 132,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  partChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  partChipName: { fontSize: fontSize.xs, color: colors.textPrimary, fontWeight: '700' },
  partChipStock: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  partChipTextActive: { color: colors.white },
  partAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  partQtyInput: {
    width: 88,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  partAddBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  partAddBtnText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  usageText: { fontSize: fontSize.xs, color: colors.textPrimary, fontWeight: '600' },
  usageRemove: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700' },
  emptyPartText: { fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 18 },
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
