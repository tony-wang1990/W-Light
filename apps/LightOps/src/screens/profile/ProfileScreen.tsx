import React, { useCallback, useState } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'
import {
  getOfflineQueueSummary,
  syncOfflineQueue,
  type OfflineQueueSummary,
} from '../../offline/offlineQueue'

export function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const [queueSummary, setQueueSummary] = useState<OfflineQueueSummary>(() => getOfflineQueueSummary())
  const [syncing, setSyncing] = useState(false)

  const refreshQueueSummary = useCallback(() => {
    setQueueSummary(getOfflineQueueSummary())
  }, [])

  useFocusEffect(
    useCallback(() => {
      refreshQueueSummary()
    }, [refreshQueueSummary]),
  )

  const ROLE_LABELS: Record<string, string> = {
    admin: '🔑 系统管理员',
    engineer: '🔧 维修工程师',
    inspector: '🔍 巡检员',
    viewer: '👁️ 只读用户',
  }

  const handleLogout = () => {
    Alert.alert('确认退出', '退出后需要重新登录', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ])
  }

  const handleSyncQueue = async () => {
    if (queueSummary.total === 0) {
      Alert.alert('离线同步', '当前没有待同步数据。')
      return
    }

    setSyncing(true)
    try {
      const result = await syncOfflineQueue()
      refreshQueueSummary()
      Alert.alert(
        '离线同步完成',
        `成功 ${result.synced} 条，待处理 ${result.pending} 条${result.conflicts ? `，冲突 ${result.conflicts} 条` : ''}。`,
      )
    } catch (error: unknown) {
      refreshQueueSummary()
      Alert.alert('离线同步失败', error instanceof Error ? error.message : '请检查网络后重试。')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>个人中心</Text>
      </View>

      <ScrollView>
        {/* Avatar & Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || '?'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
          <Text style={styles.phone}>📱 {user?.phone}</Text>
        </View>

        {/* Skills */}
        {user?.skillTags && user.skillTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>专业技能</Text>
            <View style={styles.tagsRow}>
              {user.skillTags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>离线同步</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncStats}>
              <Text style={styles.syncNumber}>{queueSummary.total}</Text>
              <View style={styles.syncTextBlock}>
                <Text style={styles.syncTitle}>待同步记录</Text>
                <Text style={styles.syncHint}>
                  {queueSummary.conflicts > 0
                    ? `有 ${queueSummary.conflicts} 条需要人工确认`
                    : queueSummary.total > 0
                      ? '网络恢复后可手动上传到云端'
                      : '本机离线队列为空'}
                </Text>
              </View>
            </View>
            {!!queueSummary.lastError && (
              <Text style={styles.syncError} numberOfLines={2}>{queueSummary.lastError}</Text>
            )}
            <TouchableOpacity
              style={[styles.syncButton, (syncing || queueSummary.total === 0) && styles.syncButtonDisabled]}
              onPress={handleSyncQueue}
              disabled={syncing || queueSummary.total === 0}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.syncButtonText}>立即同步</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>
          {[
            { icon: '🔔', label: '通知设置' },
            { icon: '🌐', label: '服务器配置' },
            { icon: '📱', label: '关于 W-Light' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.menuItem}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>W-Light v1.0.0 · 文旅灯光运维一体化平台</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  // Profile Card
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  role: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600', marginTop: 4 },
  phone: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  // Skills
  section: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.primary + '22',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  // Offline sync
  syncCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncStats: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  syncNumber: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '22',
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginRight: spacing.md,
  },
  syncTextBlock: { flex: 1 },
  syncTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '700' },
  syncHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  syncError: {
    fontSize: fontSize.xs,
    color: colors.warning,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  syncButton: {
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { fontSize: fontSize.sm, color: colors.white, fontWeight: '800' },
  // Menu
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 20, marginRight: spacing.md },
  menuLabel: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
  menuArrow: { fontSize: fontSize.lg, color: colors.textMuted },
  // Logout
  logoutBtn: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.danger + '22',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger + '55',
  },
  logoutText: { fontSize: fontSize.md, color: colors.danger, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.textMuted },
})
