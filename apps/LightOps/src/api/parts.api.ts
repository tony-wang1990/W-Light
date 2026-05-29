import client from './client';
import { SparePart, PaginatedResponse } from '../types';

export interface PartListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  lowStock?: boolean;
}

export interface UsePartParams {
  partId: string;
  quantity: number;
  orderId: string;
}

export const partsApi = {
  getList: async (
    params: PartListParams,
  ): Promise<PaginatedResponse<SparePart>> => {
    const response = await client.get<PaginatedResponse<SparePart>>('/parts', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<SparePart> => {
    const response = await client.get<SparePart>(`/parts/${id}`);
    return response.data;
  },

  create: async (data: Partial<SparePart>): Promise<SparePart> => {
    const response = await client.post<SparePart>('/parts', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SparePart>): Promise<SparePart> => {
    const response = await client.patch<SparePart>(`/parts/${id}`, data);
    return response.data;
  },

  usePart: async (params: UsePartParams): Promise<SparePart> => {
    const response = await client.post<SparePart>('/parts/use', params);
    return response.data;
  },

  adjustStock: async (
    id: string,
    quantity: number,
    note: string,
  ): Promise<SparePart> => {
    const response = await client.post<SparePart>(`/parts/${id}/adjust`, {
      quantity,
      note,
    });
    return response.data;
  },

  getLowStock: async (): Promise<SparePart[]> => {
    const response = await client.get<SparePart[]>('/parts/low-stock');
    return response.data;
  },
};
