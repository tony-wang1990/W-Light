import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { calcBeamAngle, calcSpotSize, BEAM_ANGLE_REFERENCES } from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

type Mode = 'toAngle' | 'toSpot'

export function BeamAngleScreen() {
  const navigation = useNavigation()
  const [mode, setMode] = useState<Mode>('toSpot')

  // Mode 1: angle → spot
  const [distance1, setDistance1] = useState('')
  const [angle1, setAngle1] = useState('')

  // Mode 2: spot → angle
  const [distance2, setDistance2] = useState('')
  const [diameter2, setDiameter2] = useState('')

  const calcToSpot = () => {
    const d = parseFloat(distance1)
    const a = parseFloat(angle1)
    if (isNaN(d) || isNaN(a)) return null
    try { return calcSpotSize(d, a) } catch { return null }
  }

  const calcToAngle = () => {
    const d = parseFloat(distance2)
    const dia = parseFloat(diameter2)
    if (isNaN(d) || isNaN(dia)) return null
    try { return calcBeamAngle(d, dia) } catch { return null }
  }

  const spotResult = mode === 'toSpot' ? calcToSpot() : null
  const angleResult = mode === 'toAngle' ? calcToAngle() : null

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>光束角度计算</Text>
        <Text style={styles.subtitle}>基于三角函数 · 精确到 0.01°</Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'toSpot' && styles.modeBtnActive]}
            onPress={() => setMode('toSpot')}
          >
            <Text style={[styles.modeBtnText, mode === 'toSpot' && styles.modeBtnTextActive]}>
              角度 → 光斑大小
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'toAngle' && styles.modeBtnActive]}
            onPress={() => setMode('toAngle')}
          >
            <Text style={[styles.modeBtnText, mode === 'toAngle' && styles.modeBtnTextActive]}>
              光斑 → 光束角
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={styles.card}>
          {mode === 'toSpot' ? (
            <>
              <View style={styles.inputRow}>
                <View style={styles.inputItem}>
                  <Text style={styles.inputLabel}>投射距离</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={distance1}
                      onChangeText={setDistance1}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.unit}>m</Text>
                  </View>
                </View>
                <View style={styles.inputItem}>
                  <Text style={styles.inputLabel}>光束角</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={angle1}
                      onChangeText={setAngle1}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.unit}>°</Text>
                  </View>
                </View>
              </View>

              {spotResult && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultTitle}>计算结果</Text>
                  <View style={styles.resultGrid}>
                    <ResultItem label="光斑直径" value={`${spotResult.diameter} m`} big />
                    <ResultItem label="光斑半径" value={`${spotResult.radius} m`} />
                    <ResultItem label="光斑面积" value={`${spotResult.area} m²`} />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.inputRow}>
                <View style={styles.inputItem}>
                  <Text style={styles.inputLabel}>投射距离</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={distance2}
                      onChangeText={setDistance2}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.unit}>m</Text>
                  </View>
                </View>
                <View style={styles.inputItem}>
                  <Text style={styles.inputLabel}>光斑直径</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={diameter2}
                      onChangeText={setDiameter2}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.unit}>m</Text>
                  </View>
                </View>
              </View>

              {angleResult && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultTitle}>计算结果</Text>
                  <View style={styles.resultGrid}>
                    <ResultItem label="光束角度" value={`${angleResult.beamAngle}°`} big />
                    <ResultItem label="半角" value={`${angleResult.halfAngle}°`} />
                    <ResultItem label="光斑面积" value={`${angleResult.spotArea} m²`} />
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Reference Table */}
        <View style={styles.refSection}>
          <Text style={styles.refTitle}>常见灯具光束角参考</Text>
          {BEAM_ANGLE_REFERENCES.map((ref, i) => (
            <TouchableOpacity
              key={i}
              style={styles.refRow}
              onPress={() => {
                if (mode === 'toSpot') setAngle1(String(ref.angle))
              }}
            >
              <View style={styles.refLeft}>
                <Text style={styles.refType}>{ref.type}</Text>
                <Text style={styles.refDesc}>{ref.description}</Text>
              </View>
              <View style={styles.refAngleTag}>
                <Text style={styles.refAngle}>{ref.angle}°</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function ResultItem({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={resultStyles.item}>
      <Text style={[resultStyles.value, big && resultStyles.valueBig]}>{value}</Text>
      <Text style={resultStyles.label}>{label}</Text>
    </View>
  )
}

const resultStyles = StyleSheet.create({
  item: { alignItems: 'center', flex: 1 },
  value: { fontSize: fontSize.base, fontWeight: '700', color: colors.primary },
  valueBig: { fontSize: fontSize.xl },
  label: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
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
  modeBtnText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
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
  inputRow: { flexDirection: 'row', gap: spacing.md },
  inputItem: { flex: 1 },
  inputLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  inputBox: {
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
  resultBox: {
    marginTop: spacing.base,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.base,
  },
  resultTitle: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  resultGrid: { flexDirection: 'row' },
  refSection: { paddingHorizontal: spacing.base },
  refTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  refLeft: { flex: 1 },
  refType: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  refDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  refAngleTag: {
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  refAngle: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
})
