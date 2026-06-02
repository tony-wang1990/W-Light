import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Clipboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'
import { v4 as uuid } from 'uuid'

interface ChannelRow {
  id: string
  channel: string
  attribute: string
  feature: string
  defaultValue: string
  highlightValue: string
}

const ATTRIBUTE_PRESETS = ['Dimmer', 'Pan', 'Tilt', 'Color', 'Gobo', 'Shutter', 'Strobe', 'Zoom', 'Focus', 'Prism', 'Frost', 'Control']

const TEMPLATE_PROFILES = [
  {
    name: 'LED PAR RGBW 8ch',
    mode: '8CH',
    channels: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'Strobe', 'Macro', 'Control'],
  },
  {
    name: 'Beam 16ch',
    mode: '16CH',
    channels: ['Pan', 'Tilt', 'Pan Fine', 'Tilt Fine', 'Dimmer', 'Shutter', 'Color', 'Gobo', 'Gobo Rotate', 'Prism', 'Prism Rotate', 'Focus', 'Frost', 'Speed', 'Macro', 'Control'],
  },
  {
    name: 'Wash 18ch',
    mode: '18CH',
    channels: ['Pan', 'Tilt', 'Pan Fine', 'Tilt Fine', 'Dimmer', 'Shutter', 'Red', 'Green', 'Blue', 'White', 'Zoom', 'CTO', 'Color Macro', 'Effect', 'Effect Speed', 'Fan', 'Macro', 'Control'],
  },
]

const emptyChannel = (index: number): ChannelRow => ({
  id: uuid(),
  channel: String(index),
  attribute: '',
  feature: '',
  defaultValue: '0',
  highlightValue: '',
})

export function FixtureLibraryScreen() {
  const navigation = useNavigation()
  const [manufacturer, setManufacturer] = useState('Custom')
  const [model, setModel] = useState('New Fixture')
  const [mode, setMode] = useState('16CH')
  const [channels, setChannels] = useState<ChannelRow[]>([
    { ...emptyChannel(1), attribute: 'Dimmer', feature: 'Intensity', highlightValue: '255' },
    { ...emptyChannel(2), attribute: 'Shutter', feature: 'Open/Strobe', highlightValue: '255' },
  ])

  const exportJson = useMemo(() => JSON.stringify({
    manufacturer,
    model,
    mode,
    channelCount: channels.length,
    consoles: ['Tiger D4', 'KingKong', 'Generic DMX'],
    channels: channels.map(row => ({
      channel: Number(row.channel),
      attribute: row.attribute,
      feature: row.feature,
      defaultValue: row.defaultValue,
      highlightValue: row.highlightValue,
    })),
  }, null, 2), [channels, manufacturer, mode, model])

  const exportCsv = useMemo(() => [
    'channel,attribute,feature,default,highlight',
    ...channels.map(row => [
      row.channel,
      row.attribute,
      row.feature,
      row.defaultValue,
      row.highlightValue,
    ].map(value => `"${value.replace(/"/g, '""')}"`).join(',')),
  ].join('\n'), [channels])

  const addChannel = () => {
    setChannels(prev => [...prev, emptyChannel(prev.length + 1)])
  }

  const removeChannel = (id: string) => {
    setChannels(prev => prev.length > 1 ? prev.filter(row => row.id !== id) : prev)
  }

  const updateChannel = (id: string, field: keyof ChannelRow, value: string) => {
    setChannels(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const applyTemplate = (template: typeof TEMPLATE_PROFILES[number]) => {
    setModel(template.name)
    setMode(template.mode)
    setChannels(template.channels.map((attribute, index) => ({
      id: uuid(),
      channel: String(index + 1),
      attribute,
      feature: attribute,
      defaultValue: attribute === 'Shutter' ? '255' : '0',
      highlightValue: ['Dimmer', 'Shutter'].includes(attribute) ? '255' : '',
    })))
  }

  const copyExport = (type: 'json' | 'csv') => {
    Clipboard.setString(type === 'json' ? exportJson : exportCsv)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>灯库制作</Text>
        <Text style={styles.subtitle}>通道表编辑 · 模板生成 · JSON/CSV 导出</Text>

        <View style={styles.card}>
          <View style={styles.inputRow}>
            <InputField label="品牌" value={manufacturer} onChangeText={setManufacturer} />
            <InputField label="模式" value={mode} onChangeText={setMode} />
          </View>
          <InputField label="型号" value={model} onChangeText={setModel} />
          <Text style={styles.helperText}>当前 {channels.length} 个 DMX 通道，导出文本可作为老虎 D4、金刚或通用灯库制作的通道草案。</Text>
        </View>

        <Text style={styles.sectionTitle}>常用模板</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
          {TEMPLATE_PROFILES.map(template => (
            <TouchableOpacity key={template.name} style={styles.templateChip} onPress={() => applyTemplate(template)}>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateMeta}>{template.channels.length}ch</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>通道表</Text>
        {channels.map((row, index) => (
          <View key={row.id} style={styles.channelCard}>
            <View style={styles.channelHeader}>
              <Text style={styles.channelIndex}>CH {index + 1}</Text>
              <TouchableOpacity onPress={() => removeChannel(row.id)}>
                <Text style={styles.deleteText}>删除</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <InputField label="通道" value={row.channel} onChangeText={value => updateChannel(row.id, 'channel', value)} numeric />
              <InputField label="属性" value={row.attribute} onChangeText={value => updateChannel(row.id, 'attribute', value)} />
            </View>
            <InputField label="功能说明" value={row.feature} onChangeText={value => updateChannel(row.id, 'feature', value)} />
            <View style={styles.inputRow}>
              <InputField label="默认值" value={row.defaultValue} onChangeText={value => updateChannel(row.id, 'defaultValue', value)} numeric />
              <InputField label="高亮值" value={row.highlightValue} onChangeText={value => updateChannel(row.id, 'highlightValue', value)} numeric />
            </View>
            <View style={styles.attrRow}>
              {ATTRIBUTE_PRESETS.slice(0, 6).map(attr => (
                <TouchableOpacity key={attr} style={styles.attrChip} onPress={() => updateChannel(row.id, 'attribute', attr)}>
                  <Text style={styles.attrChipText}>{attr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addChannel}>
          <Text style={styles.addBtnText}>添加通道</Text>
        </TouchableOpacity>

        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <Text style={styles.exportTitle}>导出预览</Text>
            <View style={styles.exportActions}>
              <TouchableOpacity style={styles.copyBtn} onPress={() => copyExport('json')}>
                <Text style={styles.copyBtnText}>复制 JSON</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.copyBtn} onPress={() => copyExport('csv')}>
                <Text style={styles.copyBtnText}>复制 CSV</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.codeText} numberOfLines={14}>{exportJson}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

function InputField({
  label,
  value,
  numeric,
  onChangeText,
}: {
  label: string
  value: string
  numeric?: boolean
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'numeric' : 'default'}
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
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    height: 40,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  helperText: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700', paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  templateRow: { paddingHorizontal: spacing.base, gap: spacing.sm, paddingBottom: spacing.base },
  templateChip: {
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  templateName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700' },
  templateMeta: { fontSize: fontSize.xs, color: colors.primary, marginTop: 3 },
  channelCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  channelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channelIndex: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '800' },
  deleteText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700' },
  attrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  attrChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  attrChipText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
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
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  exportCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  exportHeader: { gap: spacing.sm, marginBottom: spacing.sm },
  exportTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700' },
  exportActions: { flexDirection: 'row', gap: spacing.sm },
  copyBtn: {
    flex: 1,
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  copyBtnText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '800' },
  codeText: {
    backgroundColor: '#0D1117',
    color: '#3FB950',
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
  },
})
