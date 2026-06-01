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
  note?: string;
}

export interface PartOutboundResult {
  part: SparePart;
  stockAlert: boolean;
}

function toPaginatedParts(
  data: SparePart[] | PaginatedResponse<SparePart>,
  page = 1,
  pageSize = 50,
): PaginatedResponse<SparePart> {
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

export const partsApi = {
  getList: async (
    params: PartListParams,
  ): Promise<PaginatedResponse<SparePart>> => {
    const data = await client.get<SparePart[] | PaginatedResponse<SparePart>>('/parts', {
      params: {
        ...params,
        lowStockOnly: params.lowStock,
      },
    });
    return toPaginatedParts(data, params.page, params.pageSize);
  },

  getById: async (id: string): Promise<SparePart> => {
    return client.get<SparePart>(`/parts/${id}`);
  },

  create: async (data: Partial<SparePart>): Promise<SparePart> => {
    return client.post<SparePart>('/parts', data);
  },

  update: async (id: string, data: Partial<SparePart>): Promise<SparePart> => {
    return client.put<SparePart>(`/parts/${id}`, data);
  },

  usePart: async (params: UsePartParams): Promise<PartOutboundResult> => {
    return client.post<PartOutboundResult>(`/parts/${params.partId}/outbound`, {
      quantity: params.quantity,
      orderId: params.orderId,
      note: params.note,
    });
  },

  adjustStock: async (
    id: string,
    quantity: number,
    note: string,
  ): Promise<SparePart> => {
    return client.post<SparePart>(`/parts/${id}/inbound`, {
      quantity,
      note,
    });
  },

  getLowStock: async (): Promise<SparePart[]> => {
    return client.get<SparePart[]>('/parts/low-stock-alerts');
  },
};
