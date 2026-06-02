import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  calcMultiCircuit,
  POWER_PRESETS,
  type CircuitResult,
  type PowerPhase,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'
import { v4 as uuid } from 'uuid'

interface FixtureEntry {
  id: string
  name: string
  power: string
  quantity: string
}

interface CircuitEntry {
  id: string
  name: string
  voltage: string
  phase: PowerPhase
  breaker: string
  cableLength: string
  fixtures: FixtureEntry[]
}

const BREAKER_OPTIONS = ['10', '16', '20', '25', '32', '40', '63', '80', '100']

const defaultFixture = (): FixtureEntry => ({
  id: uuid(),
  name: 'LED 摇头灯',
  power: '200',
  quantity: '6',
})

const defaultCircuit = (index: number): CircuitEntry => ({
  id: uuid(),
  name: `回路 ${index}`,
  voltage: '220',
  phase: 'single',
  breaker: '32',
  cableLength: '',
  fixtures: [defaultFixture()],
})

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function loadColor(percent: number) {
  if (percent >= 100) return colors.danger
  if (percent >= 80) return colors.warning
  return colors.success
}

export function PowerCalcScreen() {
  const navigation = useNavigation()
  const [circuits, setCircuits] = useState<CircuitEntry[]>([defaultCircuit(1)])

  const result = useMemo(() => calcMultiCircuit(circuits.map(circuit => ({
    id: circuit.id,
    name: circuit.name.trim() || '未命名回路',
    voltage: toNumber(circuit.voltage, circuit.phase === 'three' ? 380 : 220),
    phase: circuit.phase,
    breakerA: toNumber(circuit.breaker, 0) || undefined,
    cableLengthM: toNumber(circuit.cableLength, 0) || undefined,
    fixtures: circuit.fixtures
      .filter(fixture => Number(fixture.power) > 0 && Number(fixture.quantity) > 0)
      .map(fixture => ({
        id: fixture.id,
        name: fixture.name.trim() || '未命名灯具',
        powerW: Number(fixture.power),
        quantity: Number(fixture.quantity),
      })),
  }))), [circuits])

  const updateCircuit = <K extends keyof Omit<CircuitEntry, 'id' | 'fixtures'>>(
    id: string,
    field: K,
    value: CircuitEntry[K],
  ) => {
    setCircuits(prev => prev.map(circuit => (
      circuit.id === id ? { ...circuit, [field]: value } : circuit
    )))
  }

  const setSupplyMode = (id: string, phase: PowerPhase) => {
    setCircuits(prev => prev.map(circuit => (
      circuit.id === id
        ? { ...circuit, phase, voltage: phase === 'three' ? '380' : '220' }
        : circuit
    )))
  }

  const addCircuit = () => {
    setCircuits(prev => [...prev, defaultCircuit(prev.length + 1)])
  }

  const removeCircuit = (id: string) => {
    setCircuits(prev => prev.length > 1 ? prev.filter(circuit => circuit.id !== id) : prev)
  }

  const addFixture = (circuitId: string, fixture?: Partial<FixtureEntry>) => {
    setCircuits(prev => prev.map(circuit => (
      circuit.id === circuitId
        ? {
          ...circuit,
          fixtures: [
            ...circuit.fixtures,
            {
              id: uuid(),
              name: fixture?.name ?? '',
              power: fixture?.power ?? '',
              quantity: fixture?.quantity ?? '1',
            },
          ],
        }
        : circuit
    )))
  }

  const removeFixture = (circuitId: string, fixtureId: string) => {
    setCircuits(prev => prev.map(circuit => {
      if (circuit.id !== circuitId || circuit.fixtures.length <= 1) return circuit
      return { ...circuit, fixtures: circuit.fixtures.filter(fixture => fixture.id !== fixtureId) }
    }))
  }

  const updateFixture = (
    circuitId: string,
    fixtureId: string,
    field: keyof FixtureEntry,
    value: string,
  ) => {
    setCircuits(prev => prev.map(circuit => (
      circuit.id === circuitId
        ? {
          ...circuit,
          fixtures: circuit.fixtures.map(fixture => (
            fixture.id === fixtureId ? { ...fixture, [field]: value } : fixture
          )),
        }
        : circuit
    )))
  }

  const addPresetToLastCircuit = (name: string, power: number) => {
    const target = circuits[circuits.length - 1]
    if (!target) return
    addFixture(target.id, { name, power: String(power), quantity: '1' })
  }

  const renderCircuit = (circuit: CircuitEntry, index: number) => {
    const circuitResult = result.byCircuit?.find(item => item.circuitId === circuit.id)

    return (
      <View key={circuit.id} style={styles.circuitCard}>
        <View style={styles.circuitHeader}>
          <View style={styles.circuitIndex}>
            <Text style={styles.circuitIndexText}>{index + 1}</Text>
          </View>
          <TextInput
            style={styles.circuitNameInput}
            value={circuit.name}
            onChangeText={value => updateCircuit(circuit.id, 'name', value)}
            placeholder="回路名称"
            placeholderTextColor={colors.textMuted}
          />
          {circuitResult && (
            <View style={[styles.loadPill, { backgroundColor: loadColor(circuitResult.breakerLoadPercent) + '22' }]}>
              <Text style={[styles.loadPillText, { color: loadColor(circuitResult.breakerLoadPercent) }]}>
                {circuitResult.breakerLoadPercent}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, circuit.phase === 'single' && styles.modeBtnActive]}
            onPress={() => setSupplyMode(circuit.id, 'single')}
          >
            <Text style={[styles.modeText, circuit.phase === 'single' && styles.modeTextActive]}>220V 单相</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, circuit.phase === 'three' && styles.modeBtnActive]}
            onPress={() => setSupplyMode(circuit.id, 'three')}
          >
            <Text style={[styles.modeText, circuit.phase === 'three' && styles.modeTextActive]}>380V 三相</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.circuitSettingRow}>
          <NumberField
            label="额定空开"
            value={circuit.breaker}
            unit="A"
            onChangeText={value => updateCircuit(circuit.id, 'breaker', value)}
          />
          <NumberField
            label="电缆长度"
            value={circuit.cableLength}
            unit="m"
            placeholder="可选"
            onChangeText={value => updateCircuit(circuit.id, 'cableLength', value)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breakerChips}>
          {BREAKER_OPTIONS.map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.breakerChip, circuit.breaker === option && styles.breakerChipActive]}
              onPress={() => updateCircuit(circuit.id, 'breaker', option)}
            >
              <Text style={[styles.breakerChipText, circuit.breaker === option && styles.breakerChipTextActive]}>
                {option}A
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {circuit.fixtures.map((fixture, fixtureIndex) => {
          const totalW = Number(fixture.power) * Number(fixture.quantity)

          return (
            <View key={fixture.id} style={styles.fixtureRow}>
              <View style={styles.fixtureNum}>
                <Text style={styles.fixtureNumText}>{fixtureIndex + 1}</Text>
              </View>
              <View style={styles.fixtureInputs}>
                <TextInput
                  style={styles.nameInput}
                  value={fixture.name}
                  onChangeText={value => updateFixture(circuit.id, fixture.id, 'name', value)}
                  placeholder="灯具名称"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.numRow}>
                  <NumberBox
                    value={fixture.power}
                    unit="W"
                    placeholder="功率"
                    onChangeText={value => updateFixture(circuit.id, fixture.id, 'power', value)}
                  />
                  <Text style={styles.times}>×</Text>
                  <NumberBox
                    value={fixture.quantity}
                    unit="台"
                    placeholder="台数"
                    onChangeText={value => updateFixture(circuit.id, fixture.id, 'quantity', value)}
                  />
                </View>
              </View>
              <View style={styles.subtotal}>
                <Text style={styles.subtotalW}>{Number.isFinite(totalW) ? (totalW / 1000).toFixed(1) : '0.0'}kW</Text>
              </View>
              <TouchableOpacity onPress={() => removeFixture(circuit.id, fixture.id)} style={styles.delBtn}>
                <Text style={styles.delText}>删除</Text>
              </TouchableOpacity>
            </View>
          )
        })}

        <View style={styles.circuitActions}>
          <TouchableOpacity style={styles.inlineAddBtn} onPress={() => addFixture(circuit.id)}>
            <Text style={styles.inlineAddText}>添加灯具</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineGhostBtn} onPress={() => removeCircuit(circuit.id)}>
            <Text style={styles.inlineDangerText}>删除回路</Text>
          </TouchableOpacity>
        </View>

        {circuitResult && <CircuitSummary result={circuitResult} />}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>功率负荷计算</Text>
        <Text style={styles.subtitle}>多回路 · 单相/三相 · 空开与电缆建议</Text>

        {circuits.map(renderCircuit)}

        <TouchableOpacity style={styles.addCircuitBtn} onPress={addCircuit}>
          <Text style={styles.addCircuitText}>添加回路</Text>
        </TouchableOpacity>

        {result.totalPowerW > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>总负荷</Text>
            <View style={styles.summaryRow}>
              <SummaryItem label="总功率" value={`${result.totalPowerKW.toFixed(2)}kW`} />
              <SummaryItem label="回路电流合计" value={`${result.currentA.toFixed(1)}A`} />
              <SummaryItem
                label="最高负载"
                value={`${(result.maxCircuitLoadPercent ?? 0).toFixed(0)}%`}
                valueColor={loadColor(result.maxCircuitLoadPercent ?? 0)}
              />
            </View>
            {(result.overloadedCircuitCount ?? 0) > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  有 {result.overloadedCircuitCount} 条回路超过安全负载，建议分回路、提高空开规格或改用三相供电。
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.presetsTitle}>快速添加到最后一个回路</Text>
        <View style={styles.presetGrid}>
          {POWER_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.model}
              style={styles.presetBtn}
              onPress={() => addPresetToLastCircuit(preset.model, preset.powerW)}
            >
              <Text style={styles.presetName}>{preset.model}</Text>
              <Text style={styles.presetPower}>{preset.category} · {preset.powerW}W</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function CircuitSummary({ result }: { result: CircuitResult }) {
  const percent = Math.min(result.breakerLoadPercent, 120)
  const color = loadColor(result.breakerLoadPercent)

  return (
    <View style={styles.circuitSummary}>
      <View style={styles.loadTrack}>
        <View style={[styles.loadFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.circuitResultRow}>
        <Text style={styles.circuitResultText}>{result.totalPowerKW.toFixed(2)}kW</Text>
        <Text style={[styles.circuitResultText, { color }]}>{result.currentA.toFixed(1)}A</Text>
        <Text style={styles.circuitResultText}>
          空开 {result.ratedBreakerA}A / 建议 {result.recommendedBreakerA}A
        </Text>
      </View>
      {result.cable && (
        <Text style={styles.cableText}>
          电缆建议：{result.cable.spec}{result.cable.warning ? `；${result.cable.warning}` : ''}
        </Text>
      )}
      {result.isOverloaded && (
        <Text style={styles.overloadText}>当前电流超过额定空开的安全运行区间。</Text>
      )}
    </View>
  )
}

function NumberField({
  label,
  value,
  unit,
  placeholder,
  onChangeText,
}: {
  label: string
  value: string
  unit: string
  placeholder?: string
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <NumberBox value={value} unit={unit} placeholder={placeholder} onChangeText={onChangeText} />
    </View>
  )
}

function NumberBox({
  value,
  unit,
  placeholder,
  onChangeText,
}: {
  value: string
  unit: string
  placeholder?: string
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.numBox}>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.numUnit}>{unit}</Text>
    </View>
  )
}

function SummaryItem({
  label,
  value,
  valueColor = colors.textPrimary,
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
  scrollContent: { paddingBottom: 56 },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },

  circuitCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  circuitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  circuitIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitIndexText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  circuitNameInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 36,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  loadPill: {
    width: 58,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadPillText: { fontSize: fontSize.sm, fontWeight: '800' },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 3,
  },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700' },
  modeTextActive: { color: colors.white },
  circuitSettingRow: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  fieldLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  breakerChips: { gap: spacing.xs, paddingRight: spacing.base },
  breakerChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakerChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  breakerChipText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  breakerChipTextActive: { color: colors.primary },

  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  fixtureNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureNumText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  fixtureInputs: { flex: 1 },
  nameInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 34,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    marginBottom: 4,
  },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  numBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 34,
  },
  numInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  numUnit: { fontSize: 10, color: colors.textMuted, marginLeft: 4 },
  times: { color: colors.textMuted, fontSize: fontSize.sm },
  subtotal: { alignItems: 'center', minWidth: 48 },
  subtotalW: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  delBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  delText: { color: colors.danger, fontSize: 10, fontWeight: '700' },
  circuitActions: { flexDirection: 'row', gap: spacing.sm },
  inlineAddBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  inlineGhostBtn: {
    width: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  inlineAddText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.xs },
  inlineDangerText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.xs },

  circuitSummary: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 6,
  },
  loadTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  loadFill: { height: 8, borderRadius: 4 },
  circuitResultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  circuitResultText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700' },
  cableText: { fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 18 },
  overloadText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700' },

  addCircuitBtn: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addCircuitText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  summaryCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  summaryTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: fontSize.lg, fontWeight: '800' },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  warningBox: {
    backgroundColor: colors.warning + '22',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  warningText: { fontSize: fontSize.xs, color: colors.warning, lineHeight: 18 },
  presetsTitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.base },
  presetBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    width: '47%',
  },
  presetName: { fontSize: 11, color: colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  presetPower: { fontSize: 10, color: colors.primary },
})
