import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, fontSize, radius } from '../../theme'
import { Logo } from '../../components/common/Logo'

export function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuthStore()

  const handleLogin = async () => {
    if (!phone.trim() || phone.length < 11) {
      Alert.alert('提示', '请输入正确的手机号')
      return
    }
    if (!password || password.length < 6) {
      Alert.alert('提示', '请输入密码（不少于6位）')
      return
    }

    try {
      await login({ phone: phone.trim(), password })
    } catch (err: any) {
      Alert.alert('登录失败', err.message || '手机号或密码错误')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header / Logo */}
        <View style={styles.header}>
          <Logo size={80} />
          <View style={{ height: spacing.md }} />
          <Text style={styles.appTitle}>灯光运维</Text>
          <Text style={styles.appSubtitle}>W-Light</Text>
          <Text style={styles.appTagline}>文旅灯光运维一体化平台</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>登录账号</Text>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>手机号</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>🇨🇳 +86</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="请输入手机号"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={11}
                autoComplete="tel"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>密码</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={password}
                onChangeText={setPassword}
                placeholder="请输入密码"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>登 录</Text>
            )}
          </TouchableOpacity>

          {/* Hint */}
          <Text style={styles.hint}>
            默认账号: 13800000001{'\n'}联系管理员获取密码
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 W-Light - 文旅灯光运维一体化平台 v1.0
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 3,
  },
  appTagline: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // Form
  formSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.base,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  inputPrefix: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    padding: spacing.sm,
  },
  eyeIcon: {
    fontSize: 18,
  },
  // Button
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 4,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.base,
    lineHeight: 18,
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
})
