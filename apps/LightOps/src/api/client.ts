import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()

// ─── API Base URL Config ──────────────────────────────────────────────────────
// 修改此处为你的实际服务器 IP / 域名
// 开发调试时：Android 模拟器用 10.0.2.2，真机需要填写电脑的局域网 IP
// 生产部署时：改为 https://your-domain.com/v1
const DEV_API_URL = 'http://10.0.2.2:3000/v1' // Android 模拟器默认访问宿主机 localhost
const PROD_API_URL = 'https://api.lightops.example.com/v1'

const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ─── Request Interceptor ──────────────────────────────────────────────────────
axiosClient.interceptors.request.use(
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

axiosClient.interceptors.response.use(
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
            resolve(axiosClient(originalRequest))
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
        return axiosClient(originalRequest)
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

const client = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.get(url, config),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.post(url, data, config),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.put(url, data, config),

  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.patch(url, data, config),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.delete(url, config),
}

export default client
