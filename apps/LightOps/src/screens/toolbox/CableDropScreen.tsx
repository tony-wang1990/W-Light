import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'

type PhaseMode = 'single' | 'three'

const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]

function numberValue(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function calcDrop(params: {
  voltage: number
  current: number
  lengthM: number
  sectionMm2: number
  phase: PhaseMode
}) {
  const copperResistivity = 0.0175
  const multiplier = params.phase === 'three' ? Math.sqrt(3) : 2
  const dropV = multiplier * params.current * copperResistivity * params.lengthM / Math.max(params.sectionMm2, 0.1)
  const dropPercent = params.voltage > 0 ? dropV / params.voltage * 100 : 0
  return {
    dropV: round(dropV, 2),
    dropPercent: round(dropPercent, 1),
    endVoltage: round(params.voltage - dropV, 1),
  }
}

export function CableDropScreen() {
  const navigation = useNavigation()
  const [phase, setPhase] = useState<PhaseMode>('single')
  const [voltage, setVoltage] = useState('220')
  const [current, setCurrent] = useState('16')
  const [lengthM, setLengthM] = useState('60')
  const [sectionMm2, setSectionMm2] = useState(2.5)

  const result = useMemo(() => calcDrop({
    phase,
    voltage: numberValue(voltage, phase === 'three' ? 380 : 220),
    current: numberValue(current, 0),
    lengthM: numberValue(lengthM, 0),
    sectionMm2,
  }), [current, lengthM, phase, sectionMm2, voltage])

  const recommendedSection = useMemo(() => {
    const params = {
      phase,
      voltage: numberValue(voltage, phase === 'three' ? 380 : 220),
      current: numberValue(current, 0),
      lengthM: numberValue(lengthM, 0),
    }
    return SECTIONS.find(section => calcDrop({ ...params, sectionMm2: section }).dropPercent <= 3) ?? SECTIONS[SECTIONS.length - 1]
  }, [current, lengthM, phase, voltage])

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>电缆压降计算</Text>
        <Text style={styles.subtitle}>按供电方式、电流、线长和线径估算末端电压。</Text>

        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segmentBtn, phase === 'single' && styles.segmentBtnActive]}
            onPress={() => {
              setPhase('single')
              setVoltage('220')
            }}
          >
            <Text style={[styles.segmentText, phase === 'single' && styles.segmentTextActive]}>单相 220V</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, phase === 'three' && styles.segmentBtnActive]}
            onPress={() => {
              setPhase('three')
              setVoltage('380')
            }}
          >
            <Text style={[styles.segmentText, phase === 'three' && styles.segmentTextActive]}>三相 380V</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Field label="供电电压 V" value={voltage} onChangeText={setVoltage} />
          <Field label="负载电流 A" value={current} onChangeText={setCurrent} />
          <Field label="单程线长 m" value={lengthM} onChangeText={setLengthM} />
          <Text style={styles.sectionLabel}>线径 mm2</Text>
          <View style={styles.chipRow}>
            {SECTIONS.map(section => (
              <TouchableOpacity
                key={section}
                style={[styles.chip, sectionMm2 === section && styles.chipActive]}
                onPress={() => setSectionMm2(section)}
              >
                <Text style={[styles.chipText, sectionMm2 === section && styles.chipTextActive]}>{section}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.resultGrid}>
          <Result label="压降" value={`${result.dropV} V`} tone={result.dropPercent > 5 ? 'danger' : result.dropPercent > 3 ? 'warn' : 'ok'} />
          <Result label="压降比例" value={`${result.dropPercent}%`} tone={result.dropPercent > 5 ? 'danger' : result.dropPercent > 3 ? 'warn' : 'ok'} />
          <Result label="末端电压" value={`${result.endVoltage} V`} />
          <Result label="建议线径" value={`${recommendedSection} mm2`} tone={recommendedSection > sectionMm2 ? 'warn' : 'ok'} />
        </View>
      </ScrollView>
    </View>
  )
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  )
}

function Result({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warning : tone === 'ok' ? colors.success : colors.primary
  return (
    <View style={[styles.resultCard, { borderColor: color + '66' }]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, { color }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 56 },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },
  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  segmentBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  segmentBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.xs },
  input: {
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 52,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.base },
  resultCard: {
    width: '47%',
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  resultLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: spacing.xs },
  resultValue: { fontSize: fontSize.lg, fontWeight: '800' },
})
