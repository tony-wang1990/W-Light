import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Clipboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  calculateDmxAddresses,
  FIXTURE_PRESETS,
  type DmxAddressAssignment,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'
import { v4 as uuid } from 'uuid'

interface FixtureInput {
  id: string
  name: string
  channels: string
  quantity: string
  universe: string
  startAddress: string
}

const defaultFixture = (): FixtureInput => ({
  id: uuid(),
  name: 'Moving Head',
  channels: '24',
  quantity: '1',
  universe: '',
  startAddress: '',
})

function toOptionalNumber(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.floor(parsed)
}

function formatAddress(value: number) {
  return String(value).padStart(3, '0')
}

export function DmxScreen() {
  const navigation = useNavigation()
  const [fixtures, setFixtures] = useState<FixtureInput[]>([defaultFixture()])
  const [startFrom, setStartFrom] = useState('1')

  const result = useMemo(() => {
    const fixturesInput = fixtures
      .filter(f => f.name.trim() && Number(f.channels) > 0 && Number(f.quantity) > 0)
      .map(f => ({
        id: f.id,
        name: f.name.trim(),
        channels: Number(f.channels),
        quantity: Number(f.quantity),
        universe: toOptionalNumber(f.universe),
        startAddress: toOptionalNumber(f.startAddress),
      }))

    return fixturesInput.length > 0
      ? calculateDmxAddresses(fixturesInput, Number(startFrom) || 1)
      : null
  }, [fixtures, startFrom])

  const addFixture = () => {
    setFixtures(prev => [
      ...prev,
      { id: uuid(), name: '', channels: '', quantity: '1', universe: '', startAddress: '' },
    ])
  }

  const duplicateFixture = (fixture: FixtureInput) => {
    setFixtures(prev => [
      ...prev,
      {
        ...fixture,
        id: uuid(),
        startAddress: '',
      },
    ])
  }

  const removeFixture = (id: string) => {
    setFixtures(prev => prev.length > 1 ? prev.filter(f => f.id !== id) : prev)
  }

  const updateFixture = (id: string, field: keyof FixtureInput, value: string) => {
    setFixtures(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const clearManualAddresses = () => {
    setFixtures(prev => prev.map(f => ({ ...f, universe: '', startAddress: '' })))
  }

  const addPreset = (model: string, channels: number) => {
    setFixtures(prev => [
      ...prev,
      { id: uuid(), name: model, channels: String(channels), quantity: '1', universe: '', startAddress: '' },
    ])
  }

  const assignmentHasConflict = (assignment: DmxAddressAssignment) => (
    result?.conflicts.some(conflict => (
      conflict.universe === assignment.universe
      && (conflict.fixtureA === assignment.label || conflict.fixtureB === assignment.label)
    )) ?? false
  )

  const buildPlanText = () => {
    if (!result) return ''

    const lines = [
      'W-Light DMX 地址分配方案',
      `默认起始地址：${startFrom || 1}`,
      `总通道：${result.totalChannels}ch`,
      `Universe：${result.universesNeeded}`,
      `地址冲突：${result.conflicts.length}`,
      '',
      '逐台地址：',
      ...result.assignments.map(assignment => (
        `${assignment.label} | ${assignment.channels}ch | U${assignment.universe} ${formatAddress(assignment.startAddress)}-${formatAddress(assignment.endAddress)}`
      )),
    ]

    if (result.universeUsage.length > 0) {
      lines.push('', 'Universe 使用率：')
      result.universeUsage.forEach(usage => {
        lines.push(`U${usage.universe}: ${usage.usedChannels}/512 (${Math.round(usage.utilization)}%)`)
      })
    }

    if (result.conflicts.length > 0) {
      lines.push('', '冲突：')
      result.conflicts.forEach(conflict => {
        lines.push(`U${conflict.universe} ${formatAddress(conflict.addressStart)}-${formatAddress(conflict.addressEnd)}: ${conflict.fixtureA} / ${conflict.fixtureB}`)
      })
    }

    if (result.warnings.length > 0) {
      lines.push('', '提示：', ...result.warnings)
    }

    return lines.join('\n')
  }

  const copyPlan = () => {
    if (!result) return
    Clipboard.setString(buildPlanText())
    Alert.alert('已复制', 'DMX 地址方案已复制，可粘贴到工单、备忘或聊天记录。')
  }

  const renderFixture = (fixture: FixtureInput, index: number) => {
    const rowResult = result?.fixtures.find(item => item.id === fixture.id)
    const rowAssignments = result?.assignments.filter(item => item.fixtureId === fixture.id) ?? []
    const hasConflict = rowAssignments.some(assignmentHasConflict)

    return (
      <View key={fixture.id} style={[styles.fixtureRow, hasConflict && styles.fixtureRowConflict]}>
        <View style={styles.fixtureHeader}>
          <View style={styles.fixtureIndex}>
            <Text style={styles.fixtureIndexText}>{index + 1}</Text>
          </View>
          <TextInput
            style={styles.fixtureNameInput}
            value={fixture.name}
            onChangeText={value => updateFixture(fixture.id, 'name', value)}
            placeholder="灯具名称"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.addrBox}>
            {rowResult ? (
              <>
                <Text style={styles.addrUniverse}>U{rowResult.universe ?? 1}</Text>
                <Text style={styles.addrValue}>{formatAddress(rowResult.startAddress)}</Text>
              </>
            ) : (
              <Text style={styles.addrError}>?</Text>
            )}
          </View>
        </View>

        <View style={styles.fixtureNumRow}>
          <NumberField
            label="通道"
            value={fixture.channels}
            unit="ch"
            onChangeText={value => updateFixture(fixture.id, 'channels', value)}
          />
          <NumberField
            label="数量"
            value={fixture.quantity}
            unit="台"
            onChangeText={value => updateFixture(fixture.id, 'quantity', value)}
          />
        </View>

        <View style={styles.fixtureNumRow}>
          <NumberField
            label="Universe"
            value={fixture.universe}
            unit="U"
            placeholder="自动"
            onChangeText={value => updateFixture(fixture.id, 'universe', value)}
          />
          <NumberField
            label="固定起始"
            value={fixture.startAddress}
            unit="Addr"
            placeholder="自动"
            maxLength={3}
            onChangeText={value => updateFixture(fixture.id, 'startAddress', value)}
          />
        </View>

        <View style={styles.fixtureActions}>
          <TouchableOpacity onPress={() => duplicateFixture(fixture)} style={styles.rowActionBtn}>
            <Text style={styles.rowActionText}>复制</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeFixture(fixture.id)} style={styles.rowActionBtn}>
            <Text style={styles.deleteText}>删除</Text>
          </TouchableOpacity>
          {hasConflict && <Text style={styles.conflictInline}>地址冲突</Text>}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>DMX 地址码计算</Text>
        <Text style={styles.subtitle}>多灯具链 · 固定地址 · 冲突检测</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelBox}>
            <Text style={styles.settingLabel}>默认起始地址</Text>
            <Text style={styles.settingHint}>未填写固定地址时从这里连续分配</Text>
          </View>
          <View style={styles.settingInput}>
            <TextInput
              style={styles.settingTextInput}
              value={startFrom}
              onChangeText={setStartFrom}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        {fixtures.map(renderFixture)}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.addBtn} onPress={addFixture}>
            <Text style={styles.addBtnText}>添加灯具</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={clearManualAddresses}>
            <Text style={styles.clearBtnText}>清空固定</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>地址汇总</Text>
              <TouchableOpacity style={styles.copyPlanBtn} onPress={copyPlan}>
                <Text style={styles.copyPlanText}>复制方案</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.summaryRow}>
              <SummaryItem label="总通道" value={`${result.totalChannels}ch`} />
              <SummaryItem label="Universe" value={`${result.universesNeeded} 条`} />
              <SummaryItem
                label="地址冲突"
                value={`${result.conflicts.length}`}
                valueColor={result.hasConflicts ? colors.danger : colors.primary}
              />
            </View>

            {result.universeUsage.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Universe 使用率</Text>
                {result.universeUsage.map(usage => (
                  <View key={usage.universe} style={styles.usageRow}>
                    <Text style={styles.usageLabel}>U{usage.universe}</Text>
                    <View style={styles.usageTrack}>
                      <View
                        style={[
                          styles.usageFill,
                          {
                            width: `${Math.min(usage.utilization, 100)}%`,
                            backgroundColor: usage.utilization >= 90 ? colors.warning : colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.usageValue}>{usage.usedChannels}/512</Text>
                  </View>
                ))}
              </>
            )}

            {result.hasConflicts && (
              <View style={styles.conflictBox}>
                <Text style={styles.conflictTitle}>冲突地址</Text>
                {result.conflicts.map((conflict, index) => (
                  <Text key={`${conflict.fixtureA}-${conflict.fixtureB}-${index}`} style={styles.conflictText}>
                    U{conflict.universe} {formatAddress(conflict.addressStart)}-{formatAddress(conflict.addressEnd)}
                    ：{conflict.fixtureA} / {conflict.fixtureB}
                  </Text>
                ))}
              </View>
            )}

            {result.warnings.map((warning, index) => (
              <Text key={`${warning}-${index}`} style={styles.warnText}>提示：{warning}</Text>
            ))}

            <Text style={styles.sectionTitle}>逐台地址分配</Text>
            {result.assignments.map(assignment => (
              <View
                key={assignment.id}
                style={[
                  styles.addrListRow,
                  assignmentHasConflict(assignment) && styles.addrListRowConflict,
                ]}
              >
                <View style={styles.addrListMain}>
                  <Text style={styles.addrListName}>{assignment.label}</Text>
                  <Text style={styles.addrListMeta}>{assignment.channels}ch</Text>
                </View>
                <Text style={styles.addrListValue}>
                  U{assignment.universe} {formatAddress(assignment.startAddress)}-{formatAddress(assignment.endAddress)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.presetsTitle}>常用灯具预设</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FIXTURE_PRESETS.map((preset, index) => (
            <TouchableOpacity
              key={`${preset.model}-${index}`}
              style={styles.presetChip}
              onPress={() => addPreset(preset.model, preset.channels)}
            >
              <Text style={styles.presetModel}>{preset.model}</Text>
              <Text style={styles.presetCh}>{preset.channels}ch</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  )
}

function NumberField({
  label,
  value,
  unit,
  placeholder,
  maxLength = 4,
  onChangeText,
}: {
  label: string
  value: string
  unit: string
  placeholder?: string
  maxLength?: number
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numLabel}>{label}</Text>
      <View style={styles.numInputWrap}>
        <TextInput
          style={styles.numInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
        />
        <Text style={styles.numUnit}>{unit}</Text>
      </View>
    </View>
  )
}

function SummaryItem({
  label,
  value,
  valueColor = colors.primary,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 48 },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    gap: spacing.md,
  },
  settingLabelBox: { flex: 1 },
  settingLabel: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '600' },
  settingHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  settingInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    width: 82,
    height: 42,
    justifyContent: 'center',
  },
  settingTextInput: { fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center', fontWeight: '700' },

  fixtureRow: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fixtureRowConflict: { borderColor: colors.danger, backgroundColor: colors.danger + '10' },
  fixtureHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fixtureIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureIndexText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  fixtureNameInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 36,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  fixtureNumRow: { flexDirection: 'row', gap: spacing.sm },
  numField: { flex: 1 },
  numLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  numInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 36,
  },
  numInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  numUnit: { fontSize: 10, color: colors.textMuted, marginLeft: 4 },
  addrBox: {
    width: 58,
    height: 44,
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrUniverse: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  addrValue: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  addrError: { fontSize: fontSize.sm, color: colors.danger },
  fixtureActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  rowActionText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '600' },
  conflictInline: { marginLeft: 'auto', color: colors.danger, fontSize: fontSize.xs, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  addBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },
  clearBtn: {
    width: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  clearBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm },

  summaryCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  copyPlanBtn: {
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '22',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  copyPlanText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', marginBottom: spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: fontSize.lg, fontWeight: '800' },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  usageLabel: { width: 28, fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700' },
  usageTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageFill: { height: 8, borderRadius: 4 },
  usageValue: { width: 62, fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  conflictBox: {
    backgroundColor: colors.danger + '14',
    borderWidth: 1,
    borderColor: colors.danger + '66',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  conflictTitle: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700', marginBottom: 4 },
  conflictText: { fontSize: fontSize.xs, color: colors.danger, lineHeight: 18 },
  warnText: { fontSize: fontSize.xs, color: colors.warning, marginTop: 4, lineHeight: 18 },
  addrListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  addrListRowConflict: { backgroundColor: colors.danger + '12' },
  addrListMain: { flex: 1 },
  addrListName: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  addrListMeta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  addrListValue: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] },

  presetsTitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  presetChip: {
    marginLeft: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 108,
  },
  presetModel: { fontSize: 11, color: colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  presetCh: { fontSize: 10, color: colors.primary },
})
