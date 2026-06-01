import apiClient from './client'

export interface InspectionPlan {
  id: string
  name: string
  frequency: string
  nextInspectionAt?: string
  isActive: number
}

export interface InspectionRecord {
  id: string
  planId: string
  status: string
  resultDesc?: string
  inspectedAt: string
}

export const inspectionsApi = {
  getPlans: (): Promise<InspectionPlan[]> =>
    apiClient.get<InspectionPlan[] | { items: InspectionPlan[] }>('/inspections/plans')
      .then(r => (Array.isArray(r) ? r : r.items || [])),

  getTodayPlans: (): Promise<InspectionPlan[]> =>
    apiClient.get<InspectionPlan[] | { items: InspectionPlan[] }>('/inspections/today')
      .then(r => (Array.isArray(r) ? r : r.items || [])),

  createRecord: (planId: string, status: string, resultDesc?: string): Promise<InspectionRecord> =>
    apiClient.post('/inspections/records', { planId, status, resultDesc }),
}
