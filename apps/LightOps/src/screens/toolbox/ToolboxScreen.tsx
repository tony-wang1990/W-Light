import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { colors, spacing, fontSize, radius } from '../../theme'
import type { ToolboxStackParamList } from '../../navigation/types'

interface ToolCard {
  icon: string
  name: string
  desc: string
  route: keyof ToolboxStackParamList
  color: string
}

const TOOLS: ToolCard[] = [
  { icon: 'BPM', name: 'BPM 测速', desc: '手动打拍和节奏间隔', route: 'Bpm', color: '#FF6B6B' },
  { icon: 'LTC', name: 'LTC 时码', desc: '时码段和音频生成', route: 'Ltc', color: '#4ECDC4' },
  { icon: '角', name: '光束角', desc: '投射距离和光斑直径', route: 'BeamAngle', color: '#FFD93D' },
  { icon: 'DMX', name: 'DMX 地址码', desc: '灯具链路地址规划', route: 'Dmx', color: '#6BCB77' },
  { icon: '库', name: '灯库制作', desc: '通道表和模式整理', route: 'FixtureLibrary', color: '#2DD4BF' },
  { icon: 'W', name: '功率计算', desc: '负载统计和电流估算', route: 'PowerCalc', color: '#4D96FF' },
  { icon: 'Lux', name: '照度计算', desc: '距离和照度换算', route: 'Lux', color: '#F9C74F' },
  { icon: 'RGB', name: 'RGB 配色', desc: '调色和色温记录', route: 'RgbColor', color: '#F8961E' },
]

export function ToolboxScreen() {
  const navigation = useNavigation<NavigationProp<ToolboxStackParamList>>()

  const renderCard = (tool: ToolCard) => (
    <TouchableOpacity
      key={tool.route}
      style={styles.card}
      onPress={() => navigation.navigate(tool.route)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconCircle, { backgroundColor: tool.color + '22' }]}>
        <Text style={[styles.toolIcon, { color: tool.color }]}>{tool.icon}</Text>
      </View>
      <Text style={styles.toolName}>{tool.name}</Text>
      <Text style={styles.toolDesc}>{tool.desc}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>灯光工具箱</Text>
        <Text style={styles.headerSubtitle}>现场实用工具，离线可用</Text>
      </View>

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
    fontSize: 13,
    fontWeight: '800',
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
