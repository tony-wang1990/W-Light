import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  calculateTimecodeRange,
  LTC_ROUTING_PRESETS,
  TIMECODE_FRAME_RATES,
  type TimecodeFrameRate,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function LtcScreen() {
  const navigation = useNavigation()
  const [startTimecode, setStartTimecode] = useState('01:00:00:00')
  const [frameRate, setFrameRate] = useState<TimecodeFrameRate>(25)
  const [minutes, setMinutes] = useState('5')
  const [seconds, setSeconds] = useState('0')
  const [routing, setRouting] = useState(LTC_ROUTING_PRESETS[0].name)

  const result = useMemo(() => {
    try {
      const durationSeconds = toNumber(minutes) * 60 + toNumber(seconds)
      return {
        ok: true as const,
        value: calculateTimecodeRange(startTimecode, frameRate, durationSeconds),
      }
    } catch (error: unknown) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : '时码格式错误',
      }
    }
  }, [frameRate, minutes, seconds, startTimecode])

  const selectedRouting = LTC_ROUTING_PRESETS.find(item => item.name === routing) ?? LTC_ROUTING_PRESETS[0]

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>LTC 时码工具</Text>
        <Text style={styles.subtitle}>SMPTE 换算 · 帧率 · 双声道输出配置</Text>

        <View style={styles.card}>
          <Text style={styles.label}>开始时码</Text>
          <TextInput
            style={styles.timecodeInput}
            value={startTimecode}
            onChangeText={setStartTimecode}
            placeholder="01:00:00:00"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>帧率</Text>
          <View style={styles.chipRow}>
            {TIMECODE_FRAME_RATES.map(rate => (
              <TouchableOpacity
                key={rate}
                style={[styles.chip, frameRate === rate && styles.chipActive]}
                onPress={() => setFrameRate(rate)}
              >
                <Text style={[styles.chipText, frameRate === rate && styles.chipTextActive]}>
                  {rate}fps
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>节目时长</Text>
          <View style={styles.durationRow}>
            <NumberInput value={minutes} unit="min" onChangeText={setMinutes} />
            <NumberInput value={seconds} unit="sec" onChangeText={setSeconds} />
          </View>
        </View>

        {result.ok ? (
          <View style={styles.resultCard}>
            <ResultItem label="结束时码" value={result.value.endTimecode} />
            <ResultItem label="总帧数" value={String(result.value.totalFrames)} />
            <ResultItem label="时长" value={`${result.value.durationSeconds}s`} />
            {result.value.warnings.map(warning => (
              <Text key={warning} style={styles.warningText}>提示：{warning}</Text>
            ))}
          </View>
        ) : (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{result.error}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>立体声路由方案</Text>
        {LTC_ROUTING_PRESETS.map(item => (
          <TouchableOpacity
            key={item.name}
            style={[styles.routingRow, routing === item.name && styles.routingRowActive]}
            onPress={() => setRouting(item.name)}
          >
            <View style={styles.routingMain}>
              <Text style={styles.routingName}>{item.name}</Text>
              <Text style={styles.routingUse}>{item.useCase}</Text>
            </View>
            <Text style={styles.routingMeta}>L:{item.left} / R:{item.right}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>输出建议</Text>
          <Text style={styles.noteText}>
            当前方案：{selectedRouting.name}。建议 LTC 声道保持单独输出，避免经过混响、压缩、淡入淡出或响度归一化处理；送控台前先用时码读取器验证帧率和起始时码。
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function NumberInput({
  value,
  unit,
  onChangeText,
}: {
  value: string
  unit: string
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.numberBox}>
      <TextInput
        style={styles.numberInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.unit}>{unit}</Text>
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
  },
  label: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: '700' },
  timecodeInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    height: 56,
    marginBottom: spacing.base,
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.base },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  chipText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  durationRow: { flexDirection: 'row', gap: spacing.sm },
  numberBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  numberInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  unit: { fontSize: fontSize.xs, color: colors.textMuted },
  resultCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
    rowGap: spacing.sm,
  },
  resultItem: { width: '33%', alignItems: 'center' },
  resultValue: { fontSize: fontSize.md, color: colors.primary, fontWeight: '800' },
  resultLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  warningText: { width: '100%', fontSize: fontSize.xs, color: colors.warning, lineHeight: 18 },
  errorCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.danger + '12',
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  errorText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700', paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  routingRow: {
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
  routingRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  routingMain: { flex: 1 },
  routingName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700' },
  routingUse: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  routingMeta: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },
  noteCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  noteTitle: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs },
  noteText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
})
