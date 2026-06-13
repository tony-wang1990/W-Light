import axios, { AxiosRequestConfig } from 'axios';
import { getCurrentProjectId, useAuthStore } from '../store/authStore';

export const WEB_API_BASE_URL_STORAGE_KEY = 'wlight-web-api-base-url';
const DEFAULT_DESKTOP_API_URL = 'http://127.0.0.1:3005/v1';

function defaultApiBaseUrl() {
  return ['file:', 'wlight:'].includes(window.location.protocol) ? DEFAULT_DESKTOP_API_URL : '/v1';
}

export function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return defaultApiBaseUrl();

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash === '/v1') return '/v1';
  return withoutTrailingSlash.endsWith('/v1') ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`;
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(localStorage.getItem(WEB_API_BASE_URL_STORAGE_KEY) || '');
}

export function setApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized === defaultApiBaseUrl()) {
    localStorage.removeItem(WEB_API_BASE_URL_STORAGE_KEY);
  } else {
    localStorage.setItem(WEB_API_BASE_URL_STORAGE_KEY, normalized);
  }
  axiosClient.defaults.baseURL = normalized;
  return normalized;
}

const axiosClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
});

export function getAuthRequestHeaders() {
  const state = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const projectId = getCurrentProjectId(state.user, state.currentProjectId);
  if (projectId) {
    headers['X-Project-Id'] = projectId;
  }

  return headers;
}

axiosClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  config.headers = config.headers || {};
  const authHeaders = getAuthRequestHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    config.headers[key] = value;
  }
  
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    // NestJS directly returns the data or throws standard HTTP errors
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (['file:', 'wlight:'].includes(window.location.protocol)) {
        window.location.hash = '#/login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.get(url, config),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.post(url, data, config),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.put(url, data, config),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.delete(url, config),

  download: async (url: string, filename: string) => {
    const blob = await axiosClient.get(url, { responseType: 'blob' }) as unknown as Blob;
    
    if (blob.type && blob.type.includes('application/json')) {
      const text = await blob.text();
      let errorMsg = '下载失败';
      try {
        const json = JSON.parse(text);
        errorMsg = json.message || json.error || text;
      } catch (e) {
        errorMsg = text;
      }
      throw new Error(errorMsg);
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
