import axios, { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const axiosClient = axios.create({
  baseURL: '/v1', // Using Vite proxy to localhost:3000/v1
  timeout: 10000,
});

axiosClient.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const projectId = state.user?.projectIds?.[0] || '37bccf72-9b9b-4863-882a-da95a42f20d6';
  config.headers['X-Project-Id'] = projectId;
  
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
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.get(url, config),

  post: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.post(url, data, config),

  put: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.put(url, data, config),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosClient.delete(url, config),

  download: async (url: string, filename: string) => {
    const blob = await axiosClient.get(url, { responseType: 'blob' }) as unknown as Blob;
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
