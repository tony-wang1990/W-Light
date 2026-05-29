import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ordersApi } from '../../api/orders.api'
import { colors, spacing, fontSize, radius } from '../../theme'

const STEP_TYPES = ['故障确认', '拆机检查', '更换配件', '参数调试', '功能测试', '恢复安装', '外委处理', '其他']

export function OrderRepairScreen() {
  const navigation = useNavigation()
  const route = useRoute<any>()
  const { orderId } = route.params

  const [stepType, setStepType] = useState('故障确认')
  const [stepDesc, setStepDesc] = useState('')
  const [outsourceVendor, setOutsourceVendor] = useState('')
  const [outsourceCost, setOutsourceCost] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!stepDesc.trim() || stepDesc.length < 5) {
      Alert.alert('提示', '请填写维修步骤描述（不少于5字）')
      return
    }

    setSubmitting(true)
    try {
      await ordersApi.addRepairLog(orderId, {
        stepType,
        stepDesc: stepDesc.trim(),
        outsourceVendor: outsourceVendor.trim() || undefined,
        outsourceCost: outsourceCost ? Number(outsourceCost) : undefined,
      })
      Alert.alert('✅ 记录已保存', '维修步骤已添加', [
        { text: '继续添加', onPress: () => {
          setStepDesc('')
          setOutsourceVendor('')
          setOutsourceCost('')
        }},
        { text: '返回工单', onPress: () => navigation.goBack() },
      ])
    } catch (e: any) {
      Alert.alert('保存失败', e.message)
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

        {/* Photo Hint */}
        <View style={styles.photoHint}>
          <Text style={styles.photoHintText}>
            📷 可在记录保存后，通过「查看工单」→「上传图片」添加维修现场照片
          </Text>
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
  photoHint: {
    margin: spacing.base,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  photoHintText: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
})
