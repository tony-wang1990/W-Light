import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  calculatePower, calculateCurrent, calculateCircuitLoad,
  POWER_PRESETS, PowerFixture,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

interface FixtureEntry {
  id: string
  name: string
  power: string
  quantity: string
}

export function PowerCalcScreen() {
  const navigation = useNavigation()
  const [fixtures, setFixtures] = useState<FixtureEntry[]>([
    { id: '1', name: 'LED 摇头灯', power: '200', quantity: '12' },
  ])
  const [voltage, setVoltage] = useState('220')

  const addFixture = () => {
    setFixtures(prev => [...prev, { id: String(Date.now()), name: '', power: '', quantity: '1' }])
  }

  const removeFixture = (id: string) => {
    if (fixtures.length > 1) setFixtures(prev => prev.filter(f => f.id !== id))
  }

  const updateFixture = (id: string, field: keyof FixtureEntry, value: string) => {
    setFixtures(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const fixtureData = fixtures.filter(f => Number(f.power) > 0 && Number(f.quantity) > 0)
  const results = fixtureData.map(f => {
    const totalW = Number(f.power) * Number(f.quantity)
    const v = Number(voltage) || 220
    const amps = totalW / v
    return {
      id: f.id,
      name: f.name || '未命名',
      totalW,
      amps: amps.toFixed(2),
    }
  })
  const grandTotalW = results.reduce((sum, r) => sum + r.totalW, 0)
  const grandTotalA = grandTotalW / (Number(voltage) || 220)
  const recommendedBreaker = Math.ceil(grandTotalA * 1.25 / 10) * 10

  const loadColor = grandTotalA > 80 ? colors.danger : grandTotalA > 60 ? colors.warning : colors.success

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>功率负荷计算</Text>
        <Text style={styles.subtitle}>总功耗 · 电流 · 断路器选型</Text>

        {/* Voltage Setting */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>供电电压</Text>
          <View style={styles.voltageToggle}>
            {['220', '380'].map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.voltBtn, voltage === v && styles.voltBtnActive]}
                onPress={() => setVoltage(v)}
              >
                <Text style={[styles.voltBtnText, voltage === v && styles.voltBtnTextActive]}>
                  {v}V
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fixture List */}
        {fixtures.map((f, i) => (
          <View key={f.id} style={styles.fixtureRow}>
            <View style={styles.fixtureNum}>
              <Text style={styles.fixtureNumText}>{i + 1}</Text>
            </View>
            <View style={styles.fixtureInputs}>
              <TextInput
                style={styles.nameInput}
                value={f.name}
                onChangeText={v => updateFixture(f.id, 'name', v)}
                placeholder="灯具名称"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.numRow}>
                <View style={styles.numBox}>
                  <TextInput
                    style={styles.numInput}
                    value={f.power}
                    onChangeText={v => updateFixture(f.id, 'power', v)}
                    keyboardType="numeric"
                    placeholder="功率"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.numUnit}>W</Text>
                </View>
                <Text style={styles.times}>×</Text>
                <View style={styles.numBox}>
                  <TextInput
                    style={styles.numInput}
                    value={f.quantity}
                    onChangeText={v => updateFixture(f.id, 'quantity', v)}
                    keyboardType="numeric"
                    placeholder="台数"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.numUnit}>台</Text>
                </View>
              </View>
            </View>
            {/* Subtotal */}
            {results.find(r => r.id === f.id) && (
              <View style={styles.subtotal}>
                <Text style={styles.subtotalW}>
                  {(Number(f.power) * Number(f.quantity) / 1000).toFixed(1)}kW
                </Text>
                <Text style={styles.subtotalA}>
                  {results.find(r => r.id === f.id)?.amps}A
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={() => removeFixture(f.id)} style={styles.delBtn}>
              <Text style={styles.delText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addFixture}>
          <Text style={styles.addBtnText}>+ 添加灯具</Text>
        </TouchableOpacity>

        {/* Summary */}
        {grandTotalW > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>总负荷</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{(grandTotalW / 1000).toFixed(2)}</Text>
                <Text style={styles.summaryUnit}>kW</Text>
                <Text style={styles.summaryLabel}>总功率</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: loadColor }]}>
                  {grandTotalA.toFixed(1)}
                </Text>
                <Text style={[styles.summaryUnit, { color: loadColor }]}>A</Text>
                <Text style={styles.summaryLabel}>总电流</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{recommendedBreaker}</Text>
                <Text style={styles.summaryUnit}>A</Text>
                <Text style={styles.summaryLabel}>推荐空开</Text>
              </View>
            </View>

            {grandTotalA > 100 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ 总电流超过 100A，建议分回路或使用三相供电（380V）
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Presets */}
        <Text style={styles.presetsTitle}>快速添加（常用灯具）</Text>
        <View style={styles.presetGrid}>
          {[
            { name: 'LED摇头光束灯', power: 230 },
            { name: 'LED摇头图案灯', power: 300 },
            { name: 'LED帕灯', power: 100 },
            { name: '追光灯', power: 700 },
            { name: 'LED地砖灯', power: 50 },
            { name: '激光投影仪', power: 1200 },
          ].map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.presetBtn}
              onPress={() => setFixtures(prev => [
                ...prev,
                { id: String(Date.now()), name: p.name, power: String(p.power), quantity: '1' },
              ])}
            >
              <Text style={styles.presetName}>{p.name}</Text>
              <Text style={styles.presetPower}>{p.power}W</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.base },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  settingLabel: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  voltageToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  voltBtn: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  voltBtnActive: { backgroundColor: colors.primary },
  voltBtnText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  voltBtnTextActive: { color: colors.white, fontWeight: '700' },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fixtureNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureNumText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  fixtureInputs: { flex: 1 },
  nameInput: {
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 34,
  },
  numInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  numUnit: { fontSize: 10, color: colors.textMuted },
  times: { color: colors.textMuted, fontSize: fontSize.sm },
  subtotal: { alignItems: 'center', minWidth: 50 },
  subtotalW: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  subtotalA: { fontSize: 10, color: colors.textSecondary },
  delBtn: { padding: 4 },
  delText: { color: colors.danger, fontSize: 14 },
  addBtn: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },
  // Summary
  summaryCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  summaryTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  summaryUnit: { fontSize: fontSize.sm, color: colors.textMuted },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  warningBox: {
    backgroundColor: colors.warning + '22',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  warningText: { fontSize: fontSize.xs, color: colors.warning, lineHeight: 18 },
  // Presets
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
