import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'

export function ProfileScreen() {
  const { user, logout } = useAuthStore()

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

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>
          {[
            { icon: '🔔', label: '通知设置' },
            { icon: '🌐', label: '服务器配置' },
            { icon: '📱', label: '关于 LightOps' },
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

        <Text style={styles.version}>LightOps v1.0.0 · 文旅灯光运维一体化平台</Text>
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
