import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()

const API_BASE_URL = __DEV__
  ? 'http://10.16.194.88:3000/v1'  // Android Emulator → localhost
  : 'https://api.lightops.com/v1'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ─── Request Interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.getString('access_token')
    const projectId = storage.getString('current_project_id')

    if (token) config.headers['Authorization'] = `Bearer ${token}`
    if (projectId) config.headers['X-Project-Id'] = projectId

    return config
  },
  error => Promise.reject(error),
)

// ─── Response Interceptor ─────────────────────────────────────────────────────
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
    // 统一解包 { code, data, msg } 格式
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code !== 200 && data.code !== 201) {
        return Promise.reject(new Error(data.msg || '请求失败'))
      }
      return data.data
    }
    return data
  },
  async error => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise(resolve => {
          subscribeTokenRefresh(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      isRefreshing = true
      const refreshToken = storage.getString('refresh_token')

      if (!refreshToken) {
        // 没有 refresh token，清除并跳登录（通过事件总线通知 RootNavigator）
        storage.delete('access_token')
        storage.delete('refresh_token')
        isRefreshing = false
        return Promise.reject(new Error('登录已过期，请重新登录'))
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
        const { accessToken } = response.data.data || response.data
        storage.set('access_token', accessToken)
        onTokenRefreshed(accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch {
        storage.delete('access_token')
        storage.delete('refresh_token')
        return Promise.reject(new Error('登录已过期，请重新登录'))
      } finally {
        isRefreshing = false
      }
    }

    const message = error.response?.data?.msg || error.message || '网络请求失败'
    return Promise.reject(new Error(message))
  },
)

export default apiClient
