import apiClient from './client'
import type { RepairLog, WorkOrder } from '../types'

export interface OrderListParams {
  status?: string
  priority?: string
  assigneeId?: string
  deviceId?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface PaginatedOrders {
  items: WorkOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface RepairLogPayload {
  stepType: string
  stepDesc: string
  photoUrls?: string[]
  outsourceVendor?: string
  outsourceCost?: number
  partUsages?: Array<{
    partId: string
    quantity: number
    note?: string
  }>
}

export const ordersApi = {
  list: (params?: OrderListParams): Promise<PaginatedOrders> =>
    apiClient.get('/orders', { params }),

  summary: (): Promise<Record<string, number>> =>
    apiClient.get('/orders/summary'),

  getById: (id: string): Promise<WorkOrder> =>
    apiClient.get(`/orders/${id}`),

  create: (data: {
    deviceId?: string
    category: string
    priority: string
    faultType?: string
    faultDesc: string
    mediaUrls?: string[]
    locationDesc?: string
    faultAt?: string
  }): Promise<WorkOrder> =>
    apiClient.post('/orders', data),

  assign: (id: string, assigneeId: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/assign`, { assigneeId }),

  accept: (id: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/accept`),

  reject: (id: string, reason: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/reject`, { reason }),

  suspend: (id: string, reason: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/suspend`, { reason }),

  resume: (id: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/resume`),

  submit: (id: string, repairCost?: number): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/submit`, { repairCost }),

  acceptCheck: (id: string, note?: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/accept-check`, { note }),

  rejectCheck: (id: string, reason: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/reject-check`, { reason }),

  cancel: (id: string, reason: string): Promise<WorkOrder> =>
    apiClient.put(`/orders/${id}/cancel`, { reason }),

  addRepairLog: (orderId: string, data: RepairLogPayload): Promise<RepairLog> =>
    apiClient.post(`/orders/${orderId}/repair-logs`, data),

  getRepairLogs: (orderId: string): Promise<RepairLog[]> =>
    apiClient.get(`/orders/${orderId}/repair-logs`),
}
