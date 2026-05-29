import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  calculateDmxAddresses, DmxFixture, FIXTURE_PRESETS, checkAddressConflicts,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'
import { v4 as uuid } from 'uuid'

interface FixtureInput {
  id: string
  name: string
  channels: string
  quantity: string
}

export function DmxScreen() {
  const navigation = useNavigation()
  const [fixtures, setFixtures] = useState<FixtureInput[]>([
    { id: uuid(), name: 'Moving Head', channels: '24', quantity: '1' },
  ])
  const [startFrom, setStartFrom] = useState('1')

  const addFixture = () => {
    setFixtures(prev => [...prev, { id: uuid(), name: '', channels: '', quantity: '1' }])
  }

  const removeFixture = (id: string) => {
    setFixtures(prev => prev.filter(f => f.id !== id))
  }

  const updateFixture = (id: string, field: keyof FixtureInput, value: string) => {
    setFixtures(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  // Calculate
  const fixturesInput = fixtures
    .filter(f => f.name && Number(f.channels) > 0 && Number(f.quantity) > 0)
    .map(f => ({
      id: f.id,
      name: f.name,
      channels: Number(f.channels),
      quantity: Number(f.quantity),
    }))

  const result = fixturesInput.length > 0
    ? calculateDmxAddresses(fixturesInput, Number(startFrom) || 1)
    : null

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>DMX 地址码计算</Text>
        <Text style={styles.subtitle}>自动分配 · 支持多 Universe</Text>

        {/* Start Address */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>起始地址</Text>
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

        {/* Fixture List */}
        {fixtures.map((f, index) => (
          <View key={f.id} style={styles.fixtureRow}>
            <View style={styles.fixtureIndex}>
              <Text style={styles.fixtureIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.fixtureInputs}>
              <TextInput
                style={[styles.fixtureInput, styles.fixtureNameInput]}
                value={f.name}
                onChangeText={v => updateFixture(f.id, 'name', v)}
                placeholder="灯具名称"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.fixtureNumRow}>
                <View style={styles.numInputWrap}>
                  <TextInput
                    style={styles.numInput}
                    value={f.channels}
                    onChangeText={v => updateFixture(f.id, 'channels', v)}
                    keyboardType="numeric"
                    placeholder="通道数"
                    placeholderTextColor={colors.textMuted}
                    maxLength={3}
                  />
                  <Text style={styles.numUnit}>ch</Text>
                </View>
                <Text style={styles.times}>×</Text>
                <View style={styles.numInputWrap}>
                  <TextInput
                    style={styles.numInput}
                    value={f.quantity}
                    onChangeText={v => updateFixture(f.id, 'quantity', v)}
                    keyboardType="numeric"
                    placeholder="数量"
                    placeholderTextColor={colors.textMuted}
                    maxLength={3}
                  />
                  <Text style={styles.numUnit}>台</Text>
                </View>
              </View>
            </View>
            {/* Result */}
            {result && (
              <View style={styles.addrBox}>
                {(() => {
                  const r = result.fixtures.find(rf => rf.id === f.id)
                  return r ? (
                    <>
                      <Text style={styles.addrValue}>{r.startAddress}</Text>
                      <Text style={styles.addrLabel}>起始</Text>
                    </>
                  ) : <Text style={styles.addrError}>?</Text>
                })()}
              </View>
            )}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFixture(f.id)}>
              <Text style={styles.deleteIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Fixture */}
        <TouchableOpacity style={styles.addBtn} onPress={addFixture}>
          <Text style={styles.addBtnText}>+ 添加灯具</Text>
        </TouchableOpacity>

        {/* Result Summary */}
        {result && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>汇总</Text>
            <View style={styles.summaryRow}>
              <SummaryItem label="总通道数" value={`${result.totalChannels} / 512`} />
              <SummaryItem
                label="需要 Universe"
                value={`${result.universesNeeded} 条`}
              />
            </View>
            {result.hasOverflow && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ 超过 512 通道上限，需使用多 Universe 或 Art-Net
                </Text>
              </View>
            )}
            {result.warnings.map((w, i) => (
              <Text key={i} style={styles.warnText}>⚠️ {w}</Text>
            ))}

            {/* Full Address List */}
            <Text style={styles.addrListTitle}>完整地址分配</Text>
            {result.fixtures.map((f, i) => (
              <View key={f.id} style={styles.addrListRow}>
                <Text style={styles.addrListName}>{f.name}</Text>
                <Text style={styles.addrListValue}>
                  {f.startAddress} – {f.startAddress + f.channels * f.quantity - 1}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Presets */}
        <Text style={styles.presetsTitle}>常用灯具预设</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FIXTURE_PRESETS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.presetChip}
              onPress={() => setFixtures(prev => [
                ...prev,
                { id: uuid(), name: p.model, channels: String(p.channels), quantity: '1' },
              ])}
            >
              <Text style={styles.presetModel}>{p.model}</Text>
              <Text style={styles.presetCh}>{p.channels}ch</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.primary }}>{value}</Text>
      <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>{label}</Text>
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
    gap: spacing.md,
  },
  settingLabel: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  settingInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    width: 80,
    height: 40,
    justifyContent: 'center',
  },
  settingTextInput: { fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center', fontWeight: '700' },
  // Fixture row
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
    gap: spacing.xs,
  },
  fixtureIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureIndexText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  fixtureInputs: { flex: 1 },
  fixtureInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 34,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
  },
  fixtureNameInput: { marginBottom: 4 },
  fixtureNumRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  numInputWrap: {
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
  times: { fontSize: fontSize.sm, color: colors.textMuted },
  addrBox: {
    width: 52,
    height: 52,
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrValue: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  addrLabel: { fontSize: 9, color: colors.primary },
  addrError: { fontSize: fontSize.sm, color: colors.danger },
  deleteBtn: { padding: 6 },
  deleteIcon: { color: colors.danger, fontSize: 14 },
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
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  summaryTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', marginBottom: spacing.sm },
  warningBox: {
    backgroundColor: colors.warning + '22',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warningText: { fontSize: fontSize.xs, color: colors.warning },
  warnText: { fontSize: fontSize.xs, color: colors.warning, marginTop: 4 },
  addrListTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  addrListRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  addrListName: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1 },
  addrListValue: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // Presets
  presetsTitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  presetChip: {
    marginLeft: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 100,
  },
  presetModel: { fontSize: 11, color: colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  presetCh: { fontSize: 10, color: colors.primary },
})
