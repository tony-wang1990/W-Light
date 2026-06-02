import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'

const THEORY_SECTIONS = [
  {
    title: '三点布光',
    rows: [
      ['主光', '决定主体方向、亮度和阴影结构。'],
      ['辅助光', '降低阴影反差，保留层次。'],
      ['轮廓光', '从背侧勾出边缘，让主体从背景里分离。'],
    ],
  },
  {
    title: '色彩混合',
    rows: [
      ['RGB 加色', '红、绿、蓝叠加趋向白光，适用于 LED 和屏幕类光源。'],
      ['CMY 减色', '青、品红、黄通过滤色吸收光谱，常见于摇头灯颜色系统。'],
      ['互补色', '色相环相对的颜色对比强，适合节庆和视觉焦点。'],
    ],
  },
  {
    title: '现场优先级',
    rows: [
      ['安全', '吊挂、供电、漏电、过热优先于画面效果。'],
      ['可控', '先保证 Patch、地址、通道模式、信号链路正确。'],
      ['均匀', '景观和文旅项目更关注长期稳定、均匀度和维护便利。'],
    ],
  },
  {
    title: '常用角度',
    rows: [
      ['15°-25°', '聚光、人物重点、建筑细节。'],
      ['30°-45°', '中等覆盖，适合面光、侧光、局部洗墙。'],
      ['50°-70°', '大面积铺光、氛围光、近距离景观面。'],
    ],
  },
]

const CHECKLIST = [
  '控台 Patch 与灯具地址、模式一致',
  '每条 DMX 链路末端按需加终结器',
  '单回路长期负载控制在额定电流 80% 附近',
  '户外点位检查防水、电缆应力和接地',
  '关键 Cue 和 Show 文件演出前备份',
]

export function TheoryScreen() {
  const navigation = useNavigation()

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>灯光理论速查</Text>
        <Text style={styles.subtitle}>布光 · 色彩 · 现场检查</Text>

        {THEORY_SECTIONS.map(section => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.rows.map(row => (
              <View key={row[0]} style={styles.row}>
                <Text style={styles.rowTitle}>{row[0]}</Text>
                <Text style={styles.rowText}>{row[1]}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>开场前检查</Text>
          {CHECKLIST.map((item, index) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkIndex}>
                <Text style={styles.checkIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  cardTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '800', marginBottom: spacing.sm },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  rowTitle: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700', marginBottom: 3 },
  rowText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  checkIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkIndexText: { fontSize: 10, color: colors.primary, fontWeight: '800' },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
})
