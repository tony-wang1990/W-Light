import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  FAULT_TYPE_ROOTS, DIAGNOSIS_NODES,
  DiagnosisNode, DiagnosisOption, DiagnosisConcluion,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

export function DiagnosisScreen() {
  const navigation = useNavigation()
  const [faultType, setFaultType] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [conclusion, setConclusion] = useState<DiagnosisConcluion | null>(null)

  const currentNode: DiagnosisNode | null =
    currentNodeId ? DIAGNOSIS_NODES[currentNodeId] : null

  const handleFaultType = (type: string) => {
    const rootId = FAULT_TYPE_ROOTS[type]
    setFaultType(type)
    setCurrentNodeId(rootId)
    setHistory([])
    setConclusion(null)
  }

  const handleOption = (option: DiagnosisOption) => {
    if (option.conclusion) {
      setConclusion(option.conclusion)
      setCurrentNodeId(null)
    } else if (option.nextNodeId) {
      setHistory(prev => [...prev, currentNodeId!])
      setCurrentNodeId(option.nextNodeId!)
      setConclusion(null)
    }
  }

  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      setCurrentNodeId(prev)
      setConclusion(null)
    } else {
      setFaultType(null)
      setCurrentNodeId(null)
      setConclusion(null)
      setHistory([])
    }
  }

  const handleReset = () => {
    setFaultType(null)
    setCurrentNodeId(null)
    setConclusion(null)
    setHistory([])
  }

  const SEVERITY_COLORS = {
    low: colors.success,
    medium: colors.warning,
    high: colors.danger,
    critical: '#FF3B30',
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ 工具箱</Text>
        </TouchableOpacity>
        {faultType && (
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>重新开始</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>故障诊断向导</Text>
      <Text style={styles.subtitle}>逐步排查 · 快速定位根因</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Step 1: Choose Fault Type */}
        {!faultType && (
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>第一步：选择故障现象</Text>
            {Object.keys(FAULT_TYPE_ROOTS).map(type => (
              <TouchableOpacity
                key={type}
                style={styles.faultTypeBtn}
                onPress={() => handleFaultType(type)}
              >
                <Text style={styles.faultTypeBtnText}>{type}</Text>
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Diagnosis Questions */}
        {currentNode && (
          <View style={styles.stepSection}>
            {/* Breadcrumb */}
            <Text style={styles.breadcrumb}>
              {faultType} › 第 {history.length + 1} 步
            </Text>

            {/* Question */}
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{currentNode.question}</Text>
              {currentNode.hint && (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>💡 {currentNode.hint}</Text>
                </View>
              )}
            </View>

            {/* Options */}
            {currentNode.options.map((option, i) => (
              <TouchableOpacity
                key={i}
                style={styles.optionBtn}
                onPress={() => handleOption(option)}
                activeOpacity={0.75}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                <Text style={styles.optionArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {history.length > 0 && (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>‹ 上一步</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Conclusion */}
        {conclusion && (
          <View style={styles.conclusionCard}>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[conclusion.severity] + '33' }]}>
              <Text style={[styles.severityText, { color: SEVERITY_COLORS[conclusion.severity] }]}>
                {conclusion.severity === 'critical' ? '🚨 严重' :
                 conclusion.severity === 'high' ? '⚠️ 较高' :
                 conclusion.severity === 'medium' ? '🔶 一般' : '🟢 轻微'}
              </Text>
            </View>

            <Text style={styles.problemTitle}>{conclusion.problem}</Text>

            <Text style={styles.solutionTitle}>建议处理步骤：</Text>
            {conclusion.solution.map((step, i) => (
              <View key={i} style={styles.solutionStep}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.solutionStepText}>{step}</Text>
              </View>
            ))}

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>⏱️ 预计时间：{conclusion.estimatedTime}</Text>
              {conclusion.needsExpert && (
                <Text style={[styles.metaText, { color: colors.danger }]}>
                  👷 需要专业人员
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.createOrderBtn}>
              <Text style={styles.createOrderBtnText}>📋 基于此故障创建工单</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
              <Text style={styles.retryBtnText}>重新诊断</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  resetText: { fontSize: fontSize.sm, color: colors.warning },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },
  stepSection: { paddingHorizontal: spacing.base },
  stepLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
  // Fault Type
  faultTypeBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faultTypeBtnText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '600' },
  arrowText: { fontSize: 20, color: colors.textMuted },
  // Question
  breadcrumb: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  questionText: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24, fontWeight: '600' },
  hintBox: {
    backgroundColor: colors.info + '22',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  hintText: { fontSize: fontSize.xs, color: colors.info, lineHeight: 18 },
  optionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  optionArrow: { fontSize: 18, color: colors.primary },
  backBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backBtnText: { fontSize: fontSize.sm, color: colors.textSecondary },
  // Conclusion
  conclusionCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  severityText: { fontSize: fontSize.xs, fontWeight: '700' },
  problemTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  solutionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  solutionStep: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, color: colors.white, fontWeight: '700' },
  solutionStepText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary },
  createOrderBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createOrderBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryBtnText: { fontSize: fontSize.sm, color: colors.textSecondary },
})
