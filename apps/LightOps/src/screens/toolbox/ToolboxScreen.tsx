import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'

interface ToolCard {
  icon: string
  name: string
  desc: string
  route: string
  color: string
}

const TOOLS: ToolCard[] = [
  { icon: '🥁', name: 'BPM 检测', desc: '手动打拍·节奏', route: 'Bpm', color: '#FF6B6B' },
  { icon: '⏱️', name: 'LTC 时码', desc: '立体声生成', route: 'Ltc', color: '#4ECDC4' },
  { icon: '💡', name: '光束角度', desc: '投射距离·光斑', route: 'BeamAngle', color: '#FFD93D' },
  { icon: '🎮', name: 'DMX 地址码', desc: '灯具链计算', route: 'Dmx', color: '#6BCB77' },
  { icon: '⚡', name: '功率计算', desc: '负荷统计·电流', route: 'PowerCalc', color: '#4D96FF' },
  { icon: '🔍', name: '故障分析', desc: '灯具诊断·常见', route: 'Diagnosis', color: '#C77DFF' },
  { icon: '📖', name: 'MA 宏命令', desc: 'MA2/MA3 语法', route: 'MaMacros', color: '#FF9F45' },
  { icon: '🔤', name: '术语翻译', desc: '中英对照·行业', route: 'Terms', color: '#00B4D8' },
  { icon: '🌟', name: '照度计算', desc: '环境光照度', route: 'Lux', color: '#F9C74F' },
  { icon: '🎨', name: 'RGB 配色', desc: '调色·色温', route: 'RgbColor', color: '#F8961E' },
  { icon: '🔦', name: '灯位设计', desc: '布光角度参考', route: 'LightLayout', color: '#90E0EF' },
  { icon: '📊', name: '灯光理论', desc: '色彩混合基础', route: 'Theory', color: '#B5E48C' },
]

export function ToolboxScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()

  const renderCard = (tool: ToolCard) => (
    <TouchableOpacity
      key={tool.route}
      style={styles.card}
      onPress={() => {
        // 只跳转已实现的路由
        const implemented = [
          'Bpm', 'Ltc', 'Dmx', 'BeamAngle', 'PowerCalc', 'Diagnosis',
          'MaMacros', 'Terms', 'Lux', 'RgbColor', 'LightLayout', 'Theory',
        ]
        if (implemented.includes(tool.route)) {
          navigation.navigate(tool.route)
        }
      }}
      activeOpacity={0.75}
    >
      <View style={[styles.iconCircle, { backgroundColor: tool.color + '22' }]}>
        <Text style={styles.toolIcon}>{tool.icon}</Text>
      </View>
      <Text style={styles.toolName}>{tool.name}</Text>
      <Text style={styles.toolDesc}>{tool.desc}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>灯光工具箱</Text>
        <Text style={styles.headerSubtitle}>专业工具 · 离线可用</Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {TOOLS.map(renderCard)}
      </View>
    </View>
  )
}

const CARD_SIZE = '30%'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.base,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    width: CARD_SIZE,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  toolIcon: {
    fontSize: 22,
  },
  toolName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  toolDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
})
