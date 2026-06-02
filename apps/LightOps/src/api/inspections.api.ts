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
  orderId?: string
  inspectedAt: string
}

export interface InspectionRecordListResponse {
  items: InspectionRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateInspectionRecordOptions {
  createOrder?: boolean
}

function isRecordTuple(
  data: InspectionRecordListResponse | InspectionRecord[] | [InspectionRecord[], number],
): data is [InspectionRecord[], number] {
  return Array.isArray(data) && Array.isArray(data[0])
}

function normalizeRecordList(
  data: InspectionRecordListResponse | InspectionRecord[] | [InspectionRecord[], number],
  page = 1,
  pageSize = 20,
): InspectionRecordListResponse {
  if (isRecordTuple(data)) {
    const [items, total] = data
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  if (Array.isArray(data)) {
    return { items: data, total: data.length, page, pageSize, totalPages: 1 }
  }

  return data
}

export const inspectionsApi = {
  getPlans: (): Promise<InspectionPlan[]> =>
    apiClient.get<InspectionPlan[] | { items: InspectionPlan[] }>('/inspections/plans')
      .then(r => (Array.isArray(r) ? r : r.items || [])),

  getTodayPlans: (): Promise<InspectionPlan[]> =>
    apiClient.get<InspectionPlan[] | { items: InspectionPlan[] }>('/inspections/today')
      .then(r => (Array.isArray(r) ? r : r.items || [])),

  getRecords: async (
    planId: string,
    page = 1,
    pageSize = 10,
  ): Promise<InspectionRecordListResponse> => {
    const data = await apiClient.get<InspectionRecordListResponse | InspectionRecord[] | [InspectionRecord[], number]>(
      '/inspections/records',
      { params: { planId, page, pageSize } },
    )
    return normalizeRecordList(data, page, pageSize)
  },

  createRecord: (
    planId: string,
    status: string,
    resultDesc?: string,
    options?: CreateInspectionRecordOptions,
  ): Promise<InspectionRecord> =>
    apiClient.post('/inspections/records', { planId, status, resultDesc, ...options }),
}
