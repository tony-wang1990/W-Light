import apiClient from './client'

export interface OperationsSummary {
  newOrders: number
  closedOrders: number
  overtimeOrders: number
  totalRepairCost: number
}

export interface EngineerPerformance {
  id: string
  name: string
  role: string
  totalAssigned: number
  totalClosed: number
  avgRepairHours: number
  overtimeCount: number
}

export interface FaultStat {
  faultType: string
  count: number
}

export const reportsApi = {
  operationsSummary: async (startDate?: string, endDate?: string) => {
    let url = '/reports/operations-summary'
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (params.toString()) url += `?${params.toString()}`
    
    return apiClient.get<OperationsSummary>(url)
  },

  engineerPerformance: async (startDate?: string, endDate?: string) => {
    let url = '/reports/engineer-performance'
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (params.toString()) url += `?${params.toString()}`
    
    return apiClient.get<EngineerPerformance[]>(url)
  },

  faultAnalysis: async (months = 1) => {
    return apiClient.get<{ stats: FaultStat[] }>(`/reports/fault-analysis?months=${months}`)
  }
}
