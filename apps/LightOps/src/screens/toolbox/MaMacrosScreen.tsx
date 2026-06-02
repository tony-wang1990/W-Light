import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  MA_MACROS,
  MA_TERMS,
  getMacroCategories,
  getTermCategories,
  type MaMacro,
} from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

type TabType = 'macros' | 'terms'
type MacroVersionFilter = '全部' | 'MA2' | 'MA3'

export function MaMacrosScreen() {
  const navigation = useNavigation()
  const [tab, setTab] = useState<TabType>('macros')
  const [keyword, setKeyword] = useState('')
  const [macroCategory, setMacroCategory] = useState('全部')
  const [macroVersion, setMacroVersion] = useState<MacroVersionFilter>('全部')
  const [termCategory, setTermCategory] = useState('全部')

  const macroCategories = ['全部', ...getMacroCategories()]
  const termCategories = ['全部', ...getTermCategories()]

  const filteredMacros = keyword
    ? MA_MACROS.filter(m => {
        const q = keyword.toLowerCase()
        const matchKeyword = m.name.includes(keyword) ||
          m.command.toLowerCase().includes(q) ||
          m.description.includes(keyword) ||
          (m.example?.toLowerCase().includes(q) ?? false)
        const matchCategory = macroCategory === '全部' || m.category === macroCategory
        const matchVersion = macroVersion === '全部' || (m.versions?.includes(macroVersion) ?? false)
        return matchKeyword && matchCategory && matchVersion
      })
    : MA_MACROS.filter(m => {
        const matchCategory = macroCategory === '全部' || m.category === macroCategory
        const matchVersion = macroVersion === '全部' || (m.versions?.includes(macroVersion) ?? false)
        return matchCategory && matchVersion
      })

  const filteredTerms = keyword
    ? MA_TERMS.filter(t => {
        const q = keyword.toLowerCase()
        const matchKeyword = t.cn.includes(keyword) ||
          t.en.toLowerCase().includes(q) ||
          (t.abbr && t.abbr.toLowerCase().includes(q)) ||
          (t.desc?.toLowerCase().includes(q) ?? false)
        const matchCategory = termCategory === '全部' || t.category === termCategory
        return matchKeyword && matchCategory
      })
    : MA_TERMS.filter(t => termCategory === '全部' || t.category === termCategory)

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <Text style={styles.title}>MA 宏命令 & 术语</Text>
      <Text style={styles.subtitle}>MA2 / MA3 · 离线速查</Text>

      {/* Tab Toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'macros' && styles.tabActive]}
          onPress={() => setTab('macros')}
        >
          <Text style={[styles.tabText, tab === 'macros' && styles.tabTextActive]}>
            宏命令 ({MA_MACROS.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'terms' && styles.tabActive]}
          onPress={() => setTab('terms')}
        >
          <Text style={[styles.tabText, tab === 'terms' && styles.tabTextActive]}>
            术语对照 ({MA_TERMS.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={tab === 'macros' ? '搜索命令...' : '搜索术语...'}
          placeholderTextColor={colors.textMuted}
        />
        {keyword !== '' && (
          <TouchableOpacity onPress={() => setKeyword('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {tab === 'macros' ? (
        <>
          <FilterChips
            values={macroCategories}
            active={macroCategory}
            onChange={setMacroCategory}
          />
          <FilterChips
            values={['全部', 'MA2', 'MA3']}
            active={macroVersion}
            onChange={value => setMacroVersion(value as MacroVersionFilter)}
          />
        </>
      ) : (
        <FilterChips
          values={termCategories}
          active={termCategory}
          onChange={setTermCategory}
        />
      )}

      {/* Macros List */}
      {tab === 'macros' && (
        <FlatList
          data={filteredMacros}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MacroItem macro={item} />}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 80 }}
        />
      )}

      {/* Terms List */}
      {tab === 'terms' && (
        <FlatList
          data={filteredTerms}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.termRow}>
              <View style={styles.termLeft}>
                <Text style={styles.termCn}>{item.cn}</Text>
                {item.abbr && <Text style={styles.termAbbr}>{item.abbr}</Text>}
              </View>
              <Text style={styles.termEn}>{item.en}</Text>
              {item.desc && <Text style={styles.termDesc}>{item.desc}</Text>}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 80 }}
        />
      )}
    </View>
  )
}

function FilterChips({
  values,
  active,
  onChange,
}: {
  values: string[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {values.map(value => (
        <TouchableOpacity
          key={value}
          style={[styles.filterChip, active === value && styles.filterChipActive]}
          onPress={() => onChange(value)}
        >
          <Text style={[styles.filterText, active === value && styles.filterTextActive]}>
            {value}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function MacroItem({ macro }: { macro: MaMacro }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TouchableOpacity
      style={styles.macroCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.macroHeader}>
        <View style={[styles.categoryDot, { backgroundColor: macro.color || colors.primary }]} />
        <View style={styles.macroInfo}>
          <Text style={styles.macroName}>{macro.name}</Text>
          <Text style={styles.macroCategory}>{macro.category}</Text>
        </View>
        <Text style={styles.macroExpand}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Command Syntax */}
      <View style={styles.commandBox}>
        <Text style={styles.commandText}>{macro.command}</Text>
      </View>

      {expanded && (
        <>
          <Text style={styles.macroDesc}>{macro.description}</Text>
          {macro.example && (
            <View style={styles.exampleBox}>
              <Text style={styles.exampleLabel}>示例：</Text>
              <Text style={styles.exampleText}>{macro.example}</Text>
            </View>
          )}
          {macro.versions && (
            <View style={styles.versionRow}>
              {macro.versions.includes('MA2') && <VersionBadge label="MA2" />}
              {macro.versions.includes('MA3') && <VersionBadge label="MA3" />}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  )
}

function VersionBadge({ label }: { label: string }) {
  return (
    <View style={versionStyles.badge}>
      <Text style={versionStyles.text}>{label}</Text>
    </View>
  )
}

const versionStyles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primary + '33',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { fontSize: 10, color: colors.primary, fontWeight: '700' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  clearBtn: { color: colors.textMuted, fontSize: 14 },
  filterRow: { paddingHorizontal: spacing.base, gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.white },
  // Macro Card
  macroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  macroInfo: { flex: 1 },
  macroName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  macroCategory: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  macroExpand: { fontSize: 10, color: colors.textMuted },
  commandBox: {
    backgroundColor: '#0D1117',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: spacing.sm,
  },
  commandText: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
    color: '#3FB950',
    letterSpacing: 0.5,
  },
  macroDesc: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  exampleBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  exampleLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 2 },
  exampleText: { fontFamily: 'monospace', fontSize: fontSize.xs, color: colors.primary },
  versionRow: { flexDirection: 'row', gap: 6 },
  // Terms
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  termLeft: { flex: 1 },
  termCn: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  termAbbr: { fontSize: 10, color: colors.primary, marginTop: 2 },
  termEn: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right', flex: 1 },
  termDesc: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 2, lineHeight: 14 },
})
