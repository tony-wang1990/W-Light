import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'

const SCENE_COLORS = [
  { name: '古建暖白', rgb: [255, 214, 170], kelvin: 3200 },
  { name: '水景蓝', rgb: [72, 164, 255], kelvin: 8000 },
  { name: '山体月光', rgb: [180, 205, 255], kelvin: 6500 },
  { name: '森林绿', rgb: [68, 190, 120], kelvin: 5600 },
  { name: '节庆红', rgb: [255, 58, 58], kelvin: 2800 },
  { name: '琥珀金', rgb: [255, 174, 66], kelvin: 3000 },
]

function clampChannel(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(Math.max(Math.round(parsed), 0), 255)
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function kelvinToRgb(kelvin: number) {
  const temp = Math.min(Math.max(kelvin, 1000), 12000) / 100
  let red = 255
  let green = 255
  let blue = 255

  if (temp <= 66) {
    red = 255
    green = 99.4708025861 * Math.log(temp) - 161.1195681661
    blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  } else {
    red = 329.698727446 * ((temp - 60) ** -0.1332047592)
    green = 288.1221695283 * ((temp - 60) ** -0.0755148492)
    blue = 255
  }

  return [red, green, blue].map(value => Math.min(Math.max(Math.round(value), 0), 255))
}

export function RgbColorScreen() {
  const navigation = useNavigation()
  const [red, setRed] = useState('255')
  const [green, setGreen] = useState('174')
  const [blue, setBlue] = useState('66')
  const [kelvin, setKelvin] = useState('3000')

  const r = clampChannel(red)
  const g = clampChannel(green)
  const b = clampChannel(blue)
  const rgb = `rgb(${r}, ${g}, ${b})`
  const hex = rgbToHex(r, g, b)

  const applyKelvin = (value: string) => {
    setKelvin(value)
    const [nextRed, nextGreen, nextBlue] = kelvinToRgb(Number(value))
    setRed(String(nextRed))
    setGreen(String(nextGreen))
    setBlue(String(nextBlue))
  }

  const applyScene = (scene: typeof SCENE_COLORS[number]) => {
    setRed(String(scene.rgb[0]))
    setGreen(String(scene.rgb[1]))
    setBlue(String(scene.rgb[2]))
    setKelvin(String(scene.kelvin))
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>RGB / 色温配色</Text>
        <Text style={styles.subtitle}>现场调色 · 文旅场景预设 · HEX 参考</Text>

        <View style={[styles.preview, { backgroundColor: rgb }]}>
          <Text style={styles.previewHex}>{hex}</Text>
          <Text style={styles.previewRgb}>{rgb}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputRow}>
            <ColorInput label="R" value={red} onChangeText={setRed} color="#FF5A5A" />
            <ColorInput label="G" value={green} onChangeText={setGreen} color="#4CCB7F" />
            <ColorInput label="B" value={blue} onChangeText={setBlue} color="#58A6FF" />
          </View>
          <View style={styles.kelvinRow}>
            <Text style={styles.kelvinLabel}>色温</Text>
            <View style={styles.kelvinInputBox}>
              <TextInput
                style={styles.kelvinInput}
                value={kelvin}
                onChangeText={applyKelvin}
                keyboardType="numeric"
                placeholder="3000"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.unit}>K</Text>
            </View>
          </View>
          <View style={styles.kelvinPresets}>
            {[2700, 3200, 4000, 5600, 6500, 8000].map(value => (
              <TouchableOpacity key={value} style={styles.kelvinChip} onPress={() => applyKelvin(String(value))}>
                <Text style={styles.kelvinChipText}>{value}K</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>文旅常用配色</Text>
        <View style={styles.sceneGrid}>
          {SCENE_COLORS.map(scene => (
            <TouchableOpacity key={scene.name} style={styles.sceneCard} onPress={() => applyScene(scene)}>
              <View style={[styles.sceneSwatch, { backgroundColor: `rgb(${scene.rgb.join(',')})` }]} />
              <Text style={styles.sceneName}>{scene.name}</Text>
              <Text style={styles.sceneMeta}>{scene.kelvin}K · {rgbToHex(scene.rgb[0], scene.rgb[1], scene.rgb[2])}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function ColorInput({
  label,
  value,
  color,
  onChangeText,
}: {
  label: string
  value: string
  color: string
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.colorInputGroup}>
      <Text style={[styles.colorLabel, { color }]}>{label}</Text>
      <TextInput
        style={styles.colorInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        maxLength={3}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
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
  preview: {
    marginHorizontal: spacing.base,
    borderRadius: radius.md,
    minHeight: 150,
    justifyContent: 'flex-end',
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  previewHex: { fontSize: 30, color: colors.white, fontWeight: '800' },
  previewRgb: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  colorInputGroup: { flex: 1 },
  colorLabel: { fontSize: fontSize.xs, fontWeight: '800', marginBottom: spacing.xs },
  colorInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    height: 42,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  kelvinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kelvinLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '700', width: 48 },
  kelvinInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    height: 42,
    paddingHorizontal: spacing.sm,
  },
  kelvinInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  unit: { fontSize: fontSize.sm, color: colors.textMuted },
  kelvinPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  kelvinChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  kelvinChipText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  sceneGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.base, gap: spacing.sm },
  sceneCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  sceneSwatch: { height: 44, borderRadius: radius.sm, marginBottom: spacing.sm },
  sceneName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700' },
  sceneMeta: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
})
