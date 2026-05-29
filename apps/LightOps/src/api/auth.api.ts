import apiClient from './client'

export interface LoginPayload {
  phone: string
  password: string
  projectId?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    name: string
    phone: string
    role: string
    projectIds: string[]
    skillTags: string[]
    avatarUrl?: string
  }
}

export const authApi = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    apiClient.post('/auth/login', payload),

  refresh: (refreshToken: string): Promise<LoginResponse> =>
    apiClient.post('/auth/refresh', { refreshToken }),

  getMe: (): Promise<LoginResponse['user']> =>
    apiClient.get('/auth/me'),

  updateFcmToken: (fcmToken: string): Promise<void> =>
    apiClient.put('/auth/fcm-token', { fcmToken }),

  logout: (): Promise<void> =>
    apiClient.post('/auth/logout'),
}
