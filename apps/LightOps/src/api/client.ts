import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  API_BASE_URL_STORAGE_KEY,
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
} from '../config/api'
import {
  clearLastOfflineCacheHit,
  getApiCacheKey,
  getCachedApiResponse,
  isCacheableApiGet,
  recordOfflineCacheHit,
  setCachedApiResponse,
} from '../offline/offlineCache'
import { secureStorage } from '../storage/secureStorage'
import { notifySessionExpired } from '../auth/sessionEvents'

const storage = secureStorage

function getApiBaseUrl() {
  return normalizeApiBaseUrl(storage.getString(API_BASE_URL_STORAGE_KEY) || DEFAULT_API_BASE_URL)
}

const axiosClient = axios.create({
  baseURL: getApiBaseUrl(),
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

    config.baseURL = getApiBaseUrl()
    if (token) config.headers['Authorization'] = `Bearer ${token}`
    if (projectId && !config.headers['X-Project-Id']) config.headers['X-Project-Id'] = projectId

    return config
  },
  error => Promise.reject(error),
)

// ─── Response Interceptor ─────────────────────────────────────────────────────
let isRefreshing = false
type RefreshSubscriber = {
  resolve: (token: string) => void
  reject: (error: Error) => void
}
let refreshSubscribers: RefreshSubscriber[] = []

function waitForTokenRefresh() {
  return new Promise<string>((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject })
  })
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(subscriber => subscriber.resolve(token))
  refreshSubscribers = []
}

function onTokenRefreshFailed(error: Error) {
  refreshSubscribers.forEach(subscriber => subscriber.reject(error))
  refreshSubscribers = []
}

function expireSession() {
  storage.delete('access_token')
  storage.delete('refresh_token')
  notifySessionExpired()
}

function getResponseErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ msg?: string | string[]; message?: string | string[]; error?: string }>
  const payload = axiosError.response?.data
  const message = payload?.msg ?? payload?.message ?? payload?.error
  if (Array.isArray(message)) return message.join('；')
  return message || (error instanceof Error ? error.message : '') || '网络请求失败'
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
        const token = await waitForTokenRefresh()
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        return axiosClient(originalRequest)
      }

      isRefreshing = true
      const refreshToken = storage.getString('refresh_token')

      if (!refreshToken) {
        const expiredError = new Error('登录已过期，请重新登录')
        expireSession()
        onTokenRefreshFailed(expiredError)
        isRefreshing = false
        return Promise.reject(expiredError)
      }

      try {
        const response = await axios.post(`${getApiBaseUrl()}/auth/refresh`, { refreshToken }, {
          timeout: 30000,
        })
        const { accessToken, refreshToken: nextRefreshToken } = response.data.data || response.data
        storage.set('access_token', accessToken)
        if (nextRefreshToken) storage.set('refresh_token', nextRefreshToken)
        onTokenRefreshed(accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return axiosClient(originalRequest)
      } catch {
        const expiredError = new Error('登录已过期，请重新登录')
        expireSession()
        onTokenRefreshFailed(expiredError)
        return Promise.reject(expiredError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(new Error(getResponseErrorMessage(error)))
  },
)

const client = {
  get: async <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const cacheable = isCacheableApiGet(url)
    const projectId = storage.getString('current_project_id') || 'default'
    const cacheKey = getApiCacheKey(projectId, url, config?.params)

    try {
      const data = await axiosClient.get<T, T>(url, config)
      if (cacheable) {
        setCachedApiResponse(cacheKey, data)
        clearLastOfflineCacheHit(url)
      }
      return data
    } catch (error) {
      const cached = cacheable ? getCachedApiResponse<T>(cacheKey) : null
      if (cached) {
        recordOfflineCacheHit({
          cacheKey,
          url,
          cachedAt: cached.cachedAt,
          servedAt: new Date().toISOString(),
        })
        return cached.data
      }
      throw error
    }
  },

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
