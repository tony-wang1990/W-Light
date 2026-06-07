import client from './client';
import { Device, PaginatedResponse } from '../types';

export interface DeviceListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  status?: string;
  keyword?: string;
}

function toPaginatedDevices(
  data: Device[] | PaginatedResponse<Device>,
  page = 1,
  pageSize = 50,
): PaginatedResponse<Device> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  return data;
}

export const devicesApi = {
  getList: async (
    params: DeviceListParams,
  ): Promise<PaginatedResponse<Device>> => {
    const data = await client.get<Device[] | PaginatedResponse<Device>>('/devices', {
      params,
    });
    return toPaginatedDevices(data, params.page, params.pageSize);
  },

  getById: async (id: string): Promise<Device> => {
    return client.get<Device>(`/devices/${id}`);
  },

  getByQrCode: async (qrCode: string): Promise<Device> => {
    const data = await client.get<Device | { device: Device }>(
      `/devices/scan/${encodeURIComponent(qrCode)}`,
    );
    return 'device' in data ? data.device : data;
  },

  create: async (data: Partial<Device>): Promise<Device> => {
    return client.post<Device>('/devices', data);
  },

  update: async (id: string, data: Partial<Device>): Promise<Device> => {
    return client.put<Device>(`/devices/${id}`, data);
  },

};
