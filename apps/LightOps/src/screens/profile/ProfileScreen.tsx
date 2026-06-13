import React, { useCallback, useState } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Switch } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'
import {
  getOfflineQueue,
  getOfflineQueueSummary,
  isOfflineAutoSyncEnabled,
  removeOfflineQueueItem,
  setOfflineAutoSyncEnabled,
  syncOfflineQueue,
  type OfflineQueueItem,
  type OfflineQueueSummary,
} from '../../offline/offlineQueue'
import { API_BASE_URL_STORAGE_KEY, DEFAULT_API_BASE_URL, isValidApiBaseUrl, normalizeApiBaseUrl } from '../../config/api'
import { secureStorage } from '../../storage/secureStorage'

type SettingsPanelKey = 'sync' | 'server' | 'about'
type SettingsPanel = SettingsPanelKey | null

export function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const [queueSummary, setQueueSummary] = useState<OfflineQueueSummary>(() => getOfflineQueueSummary())
  const [queueItems, setQueueItems] = useState<OfflineQueueItem[]>(() => getOfflineQueue())
  const [syncing, setSyncing] = useState(false)
  const [activePanel, setActivePanel] = useState<SettingsPanel>(null)
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(() => isOfflineAutoSyncEnabled())
  const [serverUrl, setServerUrl] = useState(() => secureStorage.getString(API_BASE_URL_STORAGE_KEY) || DEFAULT_API_BASE_URL)

  const refreshQueueSummary = useCallback(() => {
    setQueueSummary(getOfflineQueueSummary())
    setQueueItems(getOfflineQueue())
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

  const handleRemoveQueueItem = (item: OfflineQueueItem) => {
    Alert.alert('移除离线记录', `确认从同步队列移除“${item.title}”？此操作不会提交到云端。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => {
          removeOfflineQueueItem(item.id)
          refreshQueueSummary()
        },
      },
    ])
  }

  const handleToggleAutoSync = (enabled: boolean) => {
    setOfflineAutoSyncEnabled(enabled)
    setAutoSyncEnabledState(enabled)
  }

  const handleSaveServerUrl = () => {
    if (!isValidApiBaseUrl(serverUrl)) {
      Alert.alert('服务器地址无效', '请输入 http:// 或 https:// 开头的服务器地址。')
      return
    }

    const normalized = normalizeApiBaseUrl(serverUrl)
    secureStorage.set(API_BASE_URL_STORAGE_KEY, normalized)
    setServerUrl(normalized)
    Alert.alert('服务器地址已保存', `当前手机端将连接：${normalized}`)
  }

  const settingsItems: Array<{ key: SettingsPanelKey; icon: string; label: string }> = [
    { key: 'sync', icon: '↻', label: '同步与通知设置' },
    { key: 'server', icon: '◎', label: '服务器配置' },
    { key: 'about', icon: 'i', label: '关于 W-Light' },
  ]

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
            {queueItems.length > 0 && (
              <View style={styles.queueList}>
                {queueItems.slice(0, 5).map(item => (
                  <View key={item.id} style={styles.queueItem}>
                    <View style={styles.queueItemHeader}>
                      <Text style={styles.queueItemTitle} numberOfLines={1}>{item.title}</Text>
                      {item.hasConflict && <Text style={styles.conflictBadge}>冲突</Text>}
                    </View>
                    <Text style={styles.queueMeta} numberOfLines={1}>
                      {item.type} · {item.attemptCount} 次尝试 · {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    {!!item.lastError && (
                      <Text style={styles.queueError} numberOfLines={2}>{item.lastError}</Text>
                    )}
                    <TouchableOpacity style={styles.queueRemoveBtn} onPress={() => handleRemoveQueueItem(item)}>
                      <Text style={styles.queueRemoveText}>手动移除</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {queueItems.length > 5 && (
                  <Text style={styles.queueMoreText}>还有 {queueItems.length - 5} 条待同步记录</Text>
                )}
              </View>
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
            <TouchableOpacity
              key={i}
              style={styles.menuItem}
              onPress={() => {
                const nextPanel = settingsItems[i]?.key || null
                setActivePanel(activePanel === nextPanel ? null : nextPanel)
              }}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activePanel === 'sync' && (
          <View style={styles.section}>
            <View style={styles.settingsPanel}>
              <Text style={styles.panelTitle}>同步与通知设置</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingTextBlock}>
                  <Text style={styles.menuLabel}>网络恢复后自动同步</Text>
                  <Text style={styles.panelText}>开启后，离线创建的工单和维修记录会在网络恢复时自动提交。</Text>
                </View>
                <Switch value={autoSyncEnabled} onValueChange={handleToggleAutoSync} />
              </View>
              <Text style={styles.panelText}>当前待同步：{queueSummary.total} 条，冲突：{queueSummary.conflicts} 条。</Text>
            </View>
          </View>
        )}

        {activePanel === 'server' && (
          <View style={styles.section}>
            <View style={styles.settingsPanel}>
              <Text style={styles.panelTitle}>服务器配置</Text>
              <Text style={styles.panelText}>填写云端 API 地址，例如 http://服务器IP:3005/v1。</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://服务器IP:3005/v1"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveServerUrl}>
                <Text style={styles.saveButtonText}>保存服务器地址</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activePanel === 'about' && (
          <View style={styles.section}>
            <View style={styles.settingsPanel}>
              <Text style={styles.panelTitle}>关于 W-Light</Text>
              <Text style={styles.panelText}>版本：v1.0.0</Text>
              <Text style={styles.panelText}>角色：{user?.role || '-'}</Text>
              <Text style={styles.panelText}>当前服务器：{normalizeApiBaseUrl(secureStorage.getString(API_BASE_URL_STORAGE_KEY) || DEFAULT_API_BASE_URL)}</Text>
              <Text style={styles.panelText}>定位：文旅灯光运维闭环、移动工单、设备台账和灯光师工具箱。</Text>
            </View>
          </View>
        )}

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
  queueList: { gap: spacing.sm, marginBottom: spacing.sm },
  queueItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueItemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  queueItemTitle: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '700' },
  conflictBadge: {
    fontSize: fontSize.xs,
    color: colors.warning,
    borderColor: colors.warning + '66',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  queueMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  queueError: { fontSize: fontSize.xs, color: colors.danger, lineHeight: 18, marginTop: 4 },
  queueRemoveBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.danger + '18',
  },
  queueRemoveText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: '700' },
  queueMoreText: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
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
  settingsPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelTitle: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '800', marginBottom: spacing.sm },
  panelText: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  settingTextBlock: { flex: 1 },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  saveButton: {
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  saveButtonText: { fontSize: fontSize.sm, color: colors.white, fontWeight: '800' },
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
