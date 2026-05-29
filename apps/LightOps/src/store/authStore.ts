import { create } from 'zustand'
import { MMKV } from 'react-native-mmkv'
import { authApi, LoginPayload } from '../api/auth.api'

const storage = new MMKV()

interface AuthUser {
  id: string
  name: string
  phone: string
  role: string
  projectIds: string[]
  skillTags: string[]
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  currentProjectId: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
  setCurrentProject: (projectId: string) => void
  refreshTokens: () => Promise<boolean>
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  currentProjectId: null,
  isAuthenticated: false,
  isLoading: false,

  initFromStorage: () => {
    const token = storage.getString('access_token')
    const refreshToken = storage.getString('refresh_token')
    const userStr = storage.getString('user')
    const currentProjectId = storage.getString('current_project_id') || null

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ user, token, refreshToken, currentProjectId, isAuthenticated: true })
      } catch {
        // Invalid stored data, clear it
        storage.delete('access_token')
        storage.delete('refresh_token')
        storage.delete('user')
      }
    }
  },

  login: async (payload: LoginPayload) => {
    set({ isLoading: true })
    try {
      const response = await authApi.login(payload)
      const { accessToken, refreshToken, user } = response

      // Persist to storage
      storage.set('access_token', accessToken)
      storage.set('refresh_token', refreshToken)
      storage.set('user', JSON.stringify(user))

      const projectId = payload.projectId || user.projectIds[0] || null
      if (projectId) storage.set('current_project_id', projectId)

      set({
        user,
        token: accessToken,
        refreshToken,
        currentProjectId: projectId,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    storage.delete('access_token')
    storage.delete('refresh_token')
    storage.delete('user')
    storage.delete('current_project_id')
    set({
      user: null,
      token: null,
      refreshToken: null,
      currentProjectId: null,
      isAuthenticated: false,
    })
  },

  setCurrentProject: (projectId: string) => {
    storage.set('current_project_id', projectId)
    set({ currentProjectId: projectId })
  },

  refreshTokens: async () => {
    const refreshToken = get().refreshToken
    if (!refreshToken) return false

    try {
      const response = await authApi.refresh(refreshToken)
      storage.set('access_token', response.accessToken)
      storage.set('refresh_token', response.refreshToken)
      set({ token: response.accessToken, refreshToken: response.refreshToken })
      return true
    } catch {
      get().logout()
      return false
    }
  },
}))
