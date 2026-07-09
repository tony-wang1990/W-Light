import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.floor(value), min), max)
}

function numeric(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseIpv4(ip: string) {
  const parts = ip.split('.').map(part => Number(part.trim()))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return [2, 0, 0, 10]
  }
  return parts
}

export function ArtNetScreen() {
  const navigation = useNavigation()
  const [net, setNet] = useState('0')
  const [subnet, setSubnet] = useState('0')
  const [universe, setUniverse] = useState('0')
  const [nodeCount, setNodeCount] = useState('4')
  const [startIp, setStartIp] = useState('2.0.0.10')

  const artnetUniverse = useMemo(() => (
    clamp(numeric(net), 0, 127) * 256
    + clamp(numeric(subnet), 0, 15) * 16
    + clamp(numeric(universe), 0, 15)
  ), [net, subnet, universe])

  const nodeIps = useMemo(() => {
    const base = parseIpv4(startIp)
    return Array.from({ length: clamp(numeric(nodeCount, 1), 1, 64) }, (_, index) => {
      const octets = [...base]
      octets[3] = clamp((base[3] ?? 10) + index, 1, 254)
      return octets.join('.')
    })
  }, [nodeCount, startIp])

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Art-Net 地址规划</Text>
        <Text style={styles.subtitle}>换算 Net / Sub-Net / Universe，并生成现场节点 IP 参考。</Text>

        <View style={styles.card}>
          <Field label="Net 0-127" value={net} onChangeText={setNet} />
          <Field label="Sub-Net 0-15" value={subnet} onChangeText={setSubnet} />
          <Field label="Universe 0-15" value={universe} onChangeText={setUniverse} />
          <Field label="起始节点 IP" value={startIp} onChangeText={setStartIp} keyboardType="numbers-and-punctuation" />
          <Field label="节点数量" value={nodeCount} onChangeText={setNodeCount} />
        </View>

        <View style={styles.resultGrid}>
          <Result label="Art-Net Universe" value={`${artnetUniverse}`} />
          <Result label="显示编号" value={`U ${artnetUniverse + 1}`} />
          <Result label="sACN Universe" value={`${artnetUniverse + 1}`} />
          <Result label="Hex" value={`0x${artnetUniverse.toString(16).toUpperCase().padStart(4, '0')}`} />
        </View>

        <View style={styles.list}>
          <Text style={styles.listTitle}>节点 IP</Text>
          {nodeIps.map((ip, index) => (
            <View key={`${ip}-${index}`} style={styles.nodeRow}>
              <Text style={styles.nodeLabel}>节点 {index + 1}</Text>
              <Text style={styles.nodeIp}>{ip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'numeric',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  keyboardType?: 'numeric' | 'numbers-and-punctuation'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  )
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
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
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.base },
  resultCard: {
    width: '47%',
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + '66',
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  resultLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: spacing.xs },
  resultValue: { color: colors.primaryLight, fontSize: fontSize.lg, fontWeight: '800' },
  list: {
    margin: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  listTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '800', padding: spacing.md },
  nodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nodeLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  nodeIp: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
})
