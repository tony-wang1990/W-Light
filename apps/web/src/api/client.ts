import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: '/v1', // Using Vite proxy to localhost:3000/v1
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const projectId = state.user?.projectIds?.[0] || '37bccf72-9b9b-4863-882a-da95a42f20d6';
  config.headers['X-Project-Id'] = projectId;
  
  return config;
});

apiClient.interceptors.response.use(
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
