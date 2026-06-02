import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { calcSpotSize } from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

const POSITION_PRESETS = [
  { name: '面光', throwM: 14, trimM: 7, targetM: 1.6, beamAngle: 25, note: '人物正面补光，注意避免压平层次' },
  { name: '侧光', throwM: 10, trimM: 5, targetM: 1.4, beamAngle: 36, note: '强化身体轮廓，适合演艺和巡游点位' },
  { name: '逆光', throwM: 12, trimM: 6, targetM: 1.7, beamAngle: 20, note: '拉开主体与背景，注意眩光控制' },
  { name: '景观洗墙', throwM: 6, trimM: 3.5, targetM: 1, beamAngle: 50, note: '大面积铺光，关注均匀度和暗区' },
]

function toNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function LightLayoutScreen() {
  const navigation = useNavigation()
  const [throwM, setThrowM] = useState('12')
  const [trimM, setTrimM] = useState('6')
  const [targetM, setTargetM] = useState('1.6')
  const [beamAngle, setBeamAngle] = useState('25')
  const [fixtureCount, setFixtureCount] = useState('6')
  const [coverageWidth, setCoverageWidth] = useState('18')

  const result = useMemo(() => {
    const throwDistance = Math.max(toNumber(throwM, 12), 0.1)
    const heightDiff = Math.max(toNumber(trimM, 6) - toNumber(targetM, 1.6), 0.1)
    const tiltAngle = Math.atan(heightDiff / throwDistance) * 180 / Math.PI
    const spot = calcSpotSize(throwDistance, Math.max(toNumber(beamAngle, 25), 1))
    const count = Math.max(Math.round(toNumber(fixtureCount, 1)), 1)
    const width = Math.max(toNumber(coverageWidth, 1), 1)
    const spacingM = width / count
    const overlap = spot.diameter > 0 ? Math.round((1 - spacingM / spot.diameter) * 100) : 0

    return {
      tiltAngle: Math.round(tiltAngle * 10) / 10,
      spotDiameter: spot.diameter,
      spotArea: spot.area,
      spacingM: Math.round(spacingM * 10) / 10,
      overlap,
    }
  }, [beamAngle, coverageWidth, fixtureCount, targetM, throwM, trimM])

  const applyPreset = (preset: typeof POSITION_PRESETS[number]) => {
    setThrowM(String(preset.throwM))
    setTrimM(String(preset.trimM))
    setTargetM(String(preset.targetM))
    setBeamAngle(String(preset.beamAngle))
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>灯位设计参考</Text>
        <Text style={styles.subtitle}>投射角 · 覆盖宽度 · 光斑重叠</Text>

        <View style={styles.card}>
          <View style={styles.inputRow}>
            <InputField label="投射距离" value={throwM} unit="m" onChangeText={setThrowM} />
            <InputField label="吊挂高度" value={trimM} unit="m" onChangeText={setTrimM} />
          </View>
          <View style={styles.inputRow}>
            <InputField label="目标高度" value={targetM} unit="m" onChangeText={setTargetM} />
            <InputField label="光束角" value={beamAngle} unit="°" onChangeText={setBeamAngle} />
          </View>
          <View style={styles.inputRow}>
            <InputField label="灯具数量" value={fixtureCount} unit="台" onChangeText={setFixtureCount} />
            <InputField label="覆盖宽度" value={coverageWidth} unit="m" onChangeText={setCoverageWidth} />
          </View>
        </View>

        <View style={styles.resultCard}>
          <ResultItem label="建议 Tilt" value={`${result.tiltAngle}°`} />
          <ResultItem label="单灯光斑" value={`${result.spotDiameter}m`} />
          <ResultItem label="布灯间距" value={`${result.spacingM}m`} />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>覆盖判断</Text>
          <Text style={[
            styles.noteText,
            { color: result.overlap >= 15 ? colors.success : colors.warning },
          ]}>
            当前光斑面积约 {result.spotArea}m²，横向重叠约 {result.overlap}%。
            {result.overlap >= 15 ? ' 覆盖较连续。' : ' 重叠偏低，建议增加灯具、放大角度或缩小覆盖宽度。'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>常用灯位场景</Text>
        {POSITION_PRESETS.map(preset => (
          <TouchableOpacity key={preset.name} style={styles.presetRow} onPress={() => applyPreset(preset)}>
            <View style={styles.presetMain}>
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetDesc}>{preset.note}</Text>
            </View>
            <Text style={styles.presetMeta}>{preset.beamAngle}°</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function InputField({
  label,
  value,
  unit,
  onChangeText,
}: {
  label: string
  value: string
  unit: string
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  )
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultItem}>
      <Text style={styles.resultValue}>{value}</Text>
      <Text style={styles.resultLabel}>{label}</Text>
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
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 42,
  },
  input: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700' },
  unit: { fontSize: fontSize.xs, color: colors.textMuted },
  resultCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  resultItem: { flex: 1, alignItems: 'center' },
  resultValue: { fontSize: fontSize.lg, color: colors.primary, fontWeight: '800' },
  resultLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  noteCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  noteTitle: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs },
  noteText: { fontSize: fontSize.sm, lineHeight: 20 },
  sectionTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700', paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  presetMain: { flex: 1 },
  presetName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700' },
  presetDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  presetMeta: { fontSize: fontSize.md, color: colors.primary, fontWeight: '800' },
})
