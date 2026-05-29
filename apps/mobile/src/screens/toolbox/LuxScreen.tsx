import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { calculateLux, LUX_REFERENCES } from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

type CalcMode = 'toLux' | 'toDistance'

export function LuxScreen() {
  const navigation = useNavigation()
  const [mode, setMode] = useState<CalcMode>('toLux')

  // Mode 1: lumens + distance → lux
  const [lumens, setLumens] = useState('')
  const [distance, setDistance] = useState('')
  const [beamAngle, setBeamAngle] = useState('')

  // Mode 2: target lux + lumens → required distance
  const [targetLux, setTargetLux] = useState('')
  const [lumens2, setLumens2] = useState('')

  const calcLux = () => {
    const l = parseFloat(lumens)
    const d = parseFloat(distance)
    if (isNaN(l) || isNaN(d) || d === 0) return null
    const lux = l / (Math.PI * Math.pow(d * Math.tan((parseFloat(beamAngle) || 30) / 2 * Math.PI / 180), 2))
    return Math.round(lux)
  }

  const calcDistance = () => {
    const l = parseFloat(lumens2)
    const lux = parseFloat(targetLux)
    if (isNaN(l) || isNaN(lux) || lux === 0) return null
    const dist = Math.sqrt(l / (Math.PI * lux)) / Math.tan((30 / 2) * Math.PI / 180)
    return dist.toFixed(2)
  }

  const luxResult = mode === 'toLux' ? calcLux() : null
  const distResult = mode === 'toDistance' ? calcDistance() : null

  const getLuxQuality = (lux: number) => {
    if (lux >= 1000) return { label: '极亮 - 舞台主光', color: '#FFD700' }
    if (lux >= 500)  return { label: '明亮 - 演出照度', color: colors.success }
    if (lux >= 200)  return { label: '适中 - 环境照明', color: colors.info }
    if (lux >= 50)   return { label: '偏暗 - 氛围照明', color: colors.warning }
    return { label: '较暗 - 弱光区域', color: colors.textMuted }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>照度计算</Text>
        <Text style={styles.subtitle}>流明 → 照度 (Lux)</Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'toLux' && styles.modeBtnActive]}
            onPress={() => setMode('toLux')}
          >
            <Text style={[styles.modeBtnText, mode === 'toLux' && styles.modeBtnTextActive]}>
              流明 → 照度
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'toDistance' && styles.modeBtnActive]}
            onPress={() => setMode('toDistance')}
          >
            <Text style={[styles.modeBtnText, mode === 'toDistance' && styles.modeBtnTextActive]}>
              目标照度 → 距离
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.card}>
          {mode === 'toLux' ? (
            <>
              <InputField label="光通量" value={lumens} onChange={setLumens} unit="lm" placeholder="灯具流明数" />
              <InputField label="投射距离" value={distance} onChange={setDistance} unit="m" placeholder="米" />
              <InputField label="光束角度" value={beamAngle} onChange={setBeamAngle} unit="°" placeholder="30（默认）" />
              {luxResult !== null && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultValue}>{luxResult.toLocaleString()}</Text>
                  <Text style={styles.resultUnit}>Lux</Text>
                  {(() => {
                    const q = getLuxQuality(luxResult)
                    return <Text style={[styles.resultQuality, { color: q.color }]}>{q.label}</Text>
                  })()}
                </View>
              )}
            </>
          ) : (
            <>
              <InputField label="目标照度" value={targetLux} onChange={setTargetLux} unit="lx" placeholder="如 500" />
              <InputField label="灯具光通量" value={lumens2} onChange={setLumens2} unit="lm" placeholder="灯具流明数" />
              {distResult !== null && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultValue}>{distResult}</Text>
                  <Text style={styles.resultUnit}>m</Text>
                  <Text style={styles.resultQuality}>所需最大投射距离</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Reference Table */}
        <View style={styles.refSection}>
          <Text style={styles.refTitle}>照度参考标准</Text>
          {LUX_REFERENCES.map((ref, i) => (
            <View key={i} style={styles.refRow}>
              <Text style={styles.refScene}>{ref.scene}</Text>
              <Text style={styles.refRange}>{ref.min} – {ref.max} lx</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

function InputField({ label, value, onChange, unit, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  unit: string; placeholder?: string
}) {
  return (
    <View style={inputStyles.group}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={inputStyles.box}>
        <TextInput
          style={inputStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder || '0'}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={inputStyles.unit}>{unit}</Text>
      </View>
    </View>
  )
}

const inputStyles = StyleSheet.create({
  group: { marginBottom: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: { flex: 1, fontSize: fontSize.lg, color: colors.textPrimary, fontWeight: '600' },
  unit: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
  modeBtnTextActive: { color: colors.white, fontWeight: '700' },
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  resultBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  resultValue: { fontSize: 52, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  resultUnit: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '500' },
  resultQuality: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  refSection: { paddingHorizontal: spacing.base },
  refTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  refScene: { fontSize: fontSize.sm, color: colors.textSecondary },
  refRange: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
})
