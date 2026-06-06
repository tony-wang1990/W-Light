import React, { useCallback, useEffect } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { useNotificationStore } from '../../store/notificationStore'
import type { Notification } from '../../types'
import { colors, fontSize, radius, spacing } from '../../theme'

const typeLabels: Record<string, string> = {
  order: '工单',
  inspection: '巡检',
  inventory: '库存',
  system: '系统',
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const openNotification = useCallback(async (item: Notification) => {
    if (!item.isRead) await markAsRead(item.id)

    if (item.refType === 'order' && item.refId) {
      navigation.getParent()?.navigate('Orders', {
        screen: 'OrderDetail',
        params: { orderId: item.refId },
      })
    }
  }, [markAsRead, navigation])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>通知中心</Text>
          <Text style={styles.subtitle}>{unreadCount > 0 ? `${unreadCount} 条未读消息` : '暂无未读消息'}</Text>
        </View>
        <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead} disabled={unreadCount === 0}>
          <Text style={[styles.readAllText, unreadCount === 0 && styles.readAllTextDisabled]}>全部已读</Text>
        </TouchableOpacity>
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchNotifications} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
              activeOpacity={0.82}
              onPress={() => openNotification(item)}
            >
              <View style={styles.cardTop}>
                <View style={styles.titleRow}>
                  {!item.isRead && <View style={styles.unreadDot} />}
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={styles.typeBadge}>{typeLabels[item.type] || item.type || '消息'}</Text>
              </View>
              <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>暂无通知</Text>
      <Text style={styles.emptyDesc}>工单流转、巡检异常和库存提醒会在这里集中展示。</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: 56,
    paddingBottom: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  readAllBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  readAllText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },
  readAllTextDisabled: { color: colors.textMuted },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 80 },
  notificationCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  notificationCardUnread: { borderColor: colors.primary + '88', backgroundColor: colors.primary + '10' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  content: { marginTop: spacing.sm, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  time: { marginTop: spacing.sm, color: colors.textMuted, fontSize: fontSize.xs },
  empty: { alignItems: 'center', paddingTop: 96, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { marginTop: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  emptyDesc: { marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
})
