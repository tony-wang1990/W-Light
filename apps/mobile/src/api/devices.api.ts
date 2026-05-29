import client from './client';
import { Device, PaginatedResponse } from '../types';

export interface DeviceListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  status?: string;
  keyword?: string;
}

export const devicesApi = {
  getList: async (
    params: DeviceListParams,
  ): Promise<PaginatedResponse<Device>> => {
    const response = await client.get<PaginatedResponse<Device>>('/devices', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<Device> => {
    const response = await client.get<Device>(`/devices/${id}`);
    return response.data;
  },

  getByQrCode: async (qrCode: string): Promise<Device> => {
    const response = await client.get<Device>('/devices/scan', {
      params: { qrCode },
    });
    return response.data;
  },

  create: async (data: Partial<Device>): Promise<Device> => {
    const response = await client.post<Device>('/devices', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Device>): Promise<Device> => {
    const response = await client.patch<Device>(`/devices/${id}`, data);
    return response.data;
  },

  getHistory: async (
    id: string,
  ): Promise<{ date: string; score: number }[]> => {
    const response = await client.get(`/devices/${id}/history`);
    return response.data;
  },
};
