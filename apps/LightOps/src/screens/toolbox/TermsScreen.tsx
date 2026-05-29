import React, { useState } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Clipboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { MA_TERMS, LightingTerm } from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

const CATEGORIES = ['全部', '控台操作', 'DMX协议', '色彩光学', '机构部件', '信号传输', '电气']

export function TermsScreen() {
  const navigation = useNavigation()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部')

  const filtered = MA_TERMS.filter(t => {
    const matchKw = !keyword ||
      t.cn.includes(keyword) ||
      t.en.toLowerCase().includes(keyword.toLowerCase()) ||
      (t.abbr && t.abbr.toLowerCase().includes(keyword.toLowerCase()))
    const matchCat = category === '全部' || (t.category === category)
    return matchKw && matchCat
  })

  const handleCopy = (text: string) => {
    Clipboard.setString(text)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <Text style={styles.title}>灯光术语对照表</Text>
      <Text style={styles.subtitle}>中英文 · {MA_TERMS.length} 个专业术语 · 离线可用</Text>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="中文 / English / 缩写..."
          placeholderTextColor={colors.textMuted}
        />
        {keyword !== '' && (
          <TouchableOpacity onPress={() => setKeyword('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={item => item}
        style={styles.catRow}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catChip, category === item && styles.catChipActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.catText, category === item && styles.catTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.countText}>找到 {filtered.length} 个术语</Text>

      {/* Terms List */}
      <FlatList
        data={filtered}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.termCard}
            onLongPress={() => handleCopy(`${item.cn} - ${item.en}`)}
            activeOpacity={0.8}
          >
            <View style={styles.termMain}>
              <View style={styles.termLeft}>
                <Text style={styles.termCn}>{item.cn}</Text>
                {item.abbr && (
                  <View style={styles.abbrTag}>
                    <Text style={styles.abbrText}>{item.abbr}</Text>
                  </View>
                )}
              </View>
              <View style={styles.termRight}>
                <Text style={styles.termEn}>{item.en}</Text>
                {item.category && (
                  <Text style={styles.termCat}>{item.category}</Text>
                )}
              </View>
            </View>
            {item.desc && (
              <Text style={styles.termDesc}>{item.desc}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔤</Text>
            <Text style={styles.emptyText}>未找到匹配的术语</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: spacing.base, paddingTop: 56, paddingBottom: spacing.sm },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.base },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
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
  catRow: { flexGrow: 0, marginBottom: spacing.xs },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
  catTextActive: { color: colors.white },
  countText: { fontSize: fontSize.xs, color: colors.textMuted, paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 80 },
  termCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  termLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  termCn: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  abbrTag: {
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  abbrText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  termRight: { flex: 1, alignItems: 'flex-end' },
  termEn: { fontSize: fontSize.sm, color: colors.info, fontWeight: '500', textAlign: 'right' },
  termCat: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  termDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted },
})
