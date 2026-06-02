import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import {
  FAULT_TYPE_ROOTS,
  DIAGNOSIS_NODES,
  type DiagnosisNode,
  type DiagnosisOption,
  type DiagnosisConcluion,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

interface TrailItem {
  nodeId: string
  question: string
  answer: string
}

const FAULT_TYPE_META: Record<string, { risk: string; scope: string; firstCheck: string }> = {
  不亮: { risk: '中风险', scope: '电源、光源、Dimmer、控台输出', firstCheck: '先确认回路供电和灯具指示灯' },
  频闪: { risk: '中风险', scope: '供电波动、频闪通道、驱动板', firstCheck: '先区分随机闪烁还是效果频闪' },
  不受控: { risk: '低到中风险', scope: 'DMX 地址、Universe、信号链路、灯库', firstCheck: '先核对控台 Patch 与灯具地址' },
  漏电: { risk: '高危', scope: '绝缘、接地、线路破损、进水', firstCheck: '先断电隔离，不要触碰设备外壳' },
  物理损坏: { risk: '中到高风险', scope: '外壳、吊挂、透镜、运动机构', firstCheck: '先判断是否影响吊挂和人员安全' },
}

const SEVERITY_META = {
  low: { label: '轻微', color: colors.success },
  medium: { label: '一般', color: colors.warning },
  high: { label: '较高', color: colors.danger },
  critical: { label: '严重', color: '#FF3B30' },
}

export function DiagnosisScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const [faultType, setFaultType] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [history, setHistory] = useState<TrailItem[]>([])
  const [conclusion, setConclusion] = useState<DiagnosisConcluion | null>(null)

  const currentNode: DiagnosisNode | null =
    currentNodeId ? DIAGNOSIS_NODES[currentNodeId] : null

  const handleFaultType = (type: string) => {
    setFaultType(type)
    setCurrentNodeId(FAULT_TYPE_ROOTS[type])
    setHistory([])
    setConclusion(null)
  }

  const handleOption = (option: DiagnosisOption) => {
    if (!currentNode || !currentNodeId) return

    const nextHistory = [
      ...history,
      { nodeId: currentNodeId, question: currentNode.question, answer: option.label },
    ]

    if (option.conclusion) {
      setHistory(nextHistory)
      setConclusion(option.conclusion)
      setCurrentNodeId(null)
      return
    }

    if (option.nextNodeId) {
      setHistory(nextHistory)
      setCurrentNodeId(option.nextNodeId)
      setConclusion(null)
    }
  }

  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(items => items.slice(0, -1))
      setCurrentNodeId(prev.nodeId)
      setConclusion(null)
      return
    }

    setFaultType(null)
    setCurrentNodeId(null)
    setConclusion(null)
    setHistory([])
  }

  const handleReset = () => {
    setFaultType(null)
    setCurrentNodeId(null)
    setConclusion(null)
    setHistory([])
  }

  const handleCreateOrder = () => {
    if (!conclusion) return
    navigation.navigate('Orders', {
      screen: 'OrderCreate',
      params: {
        category: faultType ?? undefined,
        faultType: faultType ?? undefined,
        initialFaultDesc: `${conclusion.problem}。建议：${conclusion.solution.slice(0, 2).join('；')}`,
      },
    })
  }

  const renderFaultType = (type: string) => {
    const meta = FAULT_TYPE_META[type]

    return (
      <TouchableOpacity
        key={type}
        style={styles.faultTypeBtn}
        onPress={() => handleFaultType(type)}
      >
        <View style={styles.faultTypeMain}>
          <Text style={styles.faultTypeBtnText}>{type}</Text>
          <Text style={styles.faultTypeScope}>{meta.scope}</Text>
          <Text style={styles.faultTypeHint}>首查：{meta.firstCheck}</Text>
        </View>
        <View style={styles.riskBadge}>
          <Text style={styles.riskText}>{meta.risk}</Text>
        </View>
      </TouchableOpacity>
    )
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
      <Text style={styles.subtitle}>逐步排查 · 记录路径 · 可转工单</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!faultType && (
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>选择故障现象</Text>
            {Object.keys(FAULT_TYPE_ROOTS).map(renderFaultType)}
          </View>
        )}

        {currentNode && (
          <View style={styles.stepSection}>
            <Text style={styles.breadcrumb}>
              {faultType} · 第 {history.length + 1} 步
            </Text>

            {history.length > 0 && <TrailList items={history} />}

            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{currentNode.question}</Text>
              {currentNode.hint && (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>{currentNode.hint}</Text>
                </View>
              )}
            </View>

            {currentNode.options.map((option, index) => (
              <TouchableOpacity
                key={`${option.label}-${index}`}
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

        {conclusion && (
          <View style={styles.conclusionCard}>
            <View style={[
              styles.severityBadge,
              { backgroundColor: SEVERITY_META[conclusion.severity].color + '33' },
            ]}>
              <Text style={[
                styles.severityText,
                { color: SEVERITY_META[conclusion.severity].color },
              ]}>
                {SEVERITY_META[conclusion.severity].label}
              </Text>
            </View>

            <Text style={styles.problemTitle}>{conclusion.problem}</Text>
            <View style={styles.metaGrid}>
              <MetaItem label="预计时间" value={conclusion.estimatedTime} />
              <MetaItem label="专业人员" value={conclusion.needsExpert ? '需要' : '可现场处理'} danger={conclusion.needsExpert} />
            </View>

            {history.length > 0 && <TrailList items={history} compact />}

            {(conclusion.severity === 'critical' || conclusion.severity === 'high') && (
              <View style={styles.safetyBox}>
                <Text style={styles.safetyTitle}>安全优先</Text>
                <Text style={styles.safetyText}>
                  先断电、隔离现场、确认吊挂/接地/绝缘安全，再继续维修；不确定时交由专业人员处理。
                </Text>
              </View>
            )}

            <Text style={styles.solutionTitle}>建议处理步骤</Text>
            {conclusion.solution.map((step, index) => (
              <View key={`${step}-${index}`} style={styles.solutionStep}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.solutionStepText}>{step}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.createOrderBtn} onPress={handleCreateOrder}>
              <Text style={styles.createOrderBtnText}>基于此故障创建工单</Text>
            </TouchableOpacity>

            <View style={styles.conclusionActions}>
              <TouchableOpacity style={styles.retryBtn} onPress={handleBack}>
                <Text style={styles.retryBtnText}>上一步</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
                <Text style={styles.retryBtnText}>重新诊断</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function TrailList({ items, compact = false }: { items: TrailItem[]; compact?: boolean }) {
  return (
    <View style={[styles.trailCard, compact && styles.trailCardCompact]}>
      <Text style={styles.trailTitle}>排查路径</Text>
      {items.map((item, index) => (
        <View key={`${item.nodeId}-${index}`} style={styles.trailRow}>
          <Text style={styles.trailIndex}>{index + 1}</Text>
          <View style={styles.trailTextWrap}>
            {!compact && <Text style={styles.trailQuestion}>{item.question}</Text>}
            <Text style={styles.trailAnswer}>{item.answer}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function MetaItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaValue, danger && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 60 },
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
  stepLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },

  faultTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  faultTypeMain: { flex: 1 },
  faultTypeBtnText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700' },
  faultTypeScope: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  faultTypeHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  riskBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  riskText: { fontSize: 10, color: colors.primary, fontWeight: '700' },

  breadcrumb: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  questionText: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24, fontWeight: '700' },
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
  optionText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  optionArrow: { fontSize: 18, color: colors.primary },
  backBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  backBtnText: { fontSize: fontSize.sm, color: colors.textSecondary },

  trailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  trailCardCompact: { marginTop: spacing.sm },
  trailTitle: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
  trailRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  trailIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    backgroundColor: colors.primary + '22',
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  trailTextWrap: { flex: 1 },
  trailQuestion: { fontSize: 10, color: colors.textMuted, lineHeight: 16 },
  trailAnswer: { fontSize: fontSize.xs, color: colors.textPrimary, fontWeight: '700', lineHeight: 18 },

  conclusionCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
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
  problemTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: 22 },
  metaGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metaItem: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  metaValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '800' },
  metaLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  safetyBox: {
    backgroundColor: colors.danger + '12',
    borderWidth: 1,
    borderColor: colors.danger + '55',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  safetyTitle: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700', marginBottom: 4 },
  safetyText: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  solutionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm },
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
  createOrderBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  createOrderBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  conclusionActions: { flexDirection: 'row', gap: spacing.sm },
  retryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryBtnText: { fontSize: fontSize.sm, color: colors.textSecondary },
})
