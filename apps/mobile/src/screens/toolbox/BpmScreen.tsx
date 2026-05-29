import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { calculateBpm, isRhythmStable, bpmToMs, BPM_REFERENCES } from '@lightops/toolbox-core'
import { colors, spacing, fontSize, radius } from '../../theme'

export function BpmScreen() {
  const navigation = useNavigation()
  const [timestamps, setTimestamps] = useState<number[]>([])
  const bpmResult = timestamps.length >= 2 ? calculateBpm(timestamps) : null
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handleTap = () => {
    const now = Date.now()
    setTimestamps(prev => {
      const newTs = [...prev, now]
      // 如果间隔超过 3 秒，重新开始
      if (prev.length > 0 && now - prev[prev.length - 1] > 3000) {
        return [now]
      }
      return newTs
    })

    // Pulse animation
    scaleAnim.setValue(0.93)
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }

  const handleReset = () => {
    setTimestamps([])
  }

  const stable = timestamps.length >= 4 && isRhythmStable(timestamps)

  const getBpmColor = (bpm: number) => {
    if (bpm < 80) return '#58A6FF'
    if (bpm < 120) return '#3FB950'
    if (bpm < 150) return '#F85149'
    return '#FF3B30'
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ 工具箱</Text>
      </TouchableOpacity>

      <Text style={styles.title}>BPM 检测</Text>
      <Text style={styles.subtitle}>持续点击 · 自动计算节奏</Text>

      {/* BPM Display */}
      <View style={styles.bpmDisplay}>
        <Text style={[
          styles.bpmNumber,
          bpmResult ? { color: getBpmColor(bpmResult.bpm) } : {},
        ]}>
          {bpmResult ? bpmResult.bpm.toFixed(1) : '--'}
        </Text>
        <Text style={styles.bpmUnit}>BPM</Text>
        {bpmResult && (
          <Text style={styles.bpmMs}>{bpmToMs(bpmResult.bpm)} ms/beat</Text>
        )}
      </View>

      {/* Stats Row */}
      {bpmResult && bpmResult.tapCount >= 4 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{bpmResult.minBpm}</Text>
            <Text style={styles.statLabel}>最慢</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stable ? colors.success : colors.warning }]}>
              {stable ? '🟢 稳定' : '🟡 波动'}
            </Text>
            <Text style={styles.statLabel}>节奏</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{bpmResult.maxBpm}</Text>
            <Text style={styles.statLabel}>最快</Text>
          </View>
        </View>
      )}

      {/* Tap Count */}
      <Text style={styles.tapCount}>
        {timestamps.length === 0
          ? '点击下方大按钮开始'
          : `已打拍 ${timestamps.length} 次（超过3秒自动重置）`}
      </Text>

      {/* TAP BUTTON */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.tapButton}
          onPress={handleTap}
          activeOpacity={0.85}
        >
          <Text style={styles.tapButtonIcon}>🥁</Text>
          <Text style={styles.tapButtonText}>TAP</Text>
          <Text style={styles.tapButtonSubtext}>点击打拍</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Reset */}
      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>🔄 重置</Text>
      </TouchableOpacity>

      {/* BPM Reference */}
      <ScrollView style={styles.refSection} showsVerticalScrollIndicator={false}>
        <Text style={styles.refTitle}>常见节奏参考</Text>
        {BPM_REFERENCES.map((ref, i) => (
          <View key={i} style={styles.refRow}>
            <Text style={styles.refName}>{ref.name}</Text>
            <Text style={styles.refRange}>{ref.min} – {ref.max} BPM</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  // BPM Display
  bpmDisplay: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bpmNumber: {
    fontSize: 84,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 88,
    fontVariant: ['tabular-nums'],
  },
  bpmUnit: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 4,
  },
  bpmMs: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.base,
  },
  statItem: { alignItems: 'center' },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  // Tap count
  tapCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  // TAP Button
  tapButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    elevation: 15,
    marginBottom: spacing.xl,
  },
  tapButtonIcon: { fontSize: 40, marginBottom: 4 },
  tapButtonText: { fontSize: 28, fontWeight: '800', color: colors.white, letterSpacing: 3 },
  tapButtonSubtext: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  // Reset
  resetButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  resetText: { fontSize: fontSize.sm, color: colors.textSecondary },
  // Reference
  refSection: { width: '100%', paddingHorizontal: spacing.base },
  refTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  refName: { fontSize: fontSize.sm, color: colors.textSecondary },
  refRange: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
})
