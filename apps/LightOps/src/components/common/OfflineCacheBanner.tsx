import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '../../theme'

interface OfflineCacheBannerProps {
  cachedAt: string
  title?: string
}

function formatCachedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OfflineCacheBanner({
  cachedAt,
  title = '正在显示离线缓存',
}: OfflineCacheBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>缓存时间 {formatCachedAt(cachedAt)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning + '66',
    backgroundColor: colors.warning + '18',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  copy: { flex: 1 },
  title: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '700' },
  meta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
})
