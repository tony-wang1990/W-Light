// ─── API Response Types ───────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  msg: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>

// ─── User Types ───────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  phone: string
  role: string
  projectIds: string[]
  skillTags: string[]
  avatarUrl?: string
  isActive: boolean
  createdAt: string
}

// ─── Project Types ────────────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  venue?: string
  address?: string
  managerId: string
  status: string
  createdAt: string
}

// ─── Device Types ─────────────────────────────────────────────────────────────
export interface Device {
  id: string
  projectId: string
  deviceNo: string
  name: string
  category: string
  model?: string
  manufacturer?: string
  location?: string
  qrCode: string
  dmxAddress?: number
  channelCount?: number
  power?: number
  warrantyExpire?: string
  installDate?: string
  status: string
  healthScore: number
  lastMaintainAt?: string
  manualUrl?: string
  createdAt: string
}

// ─── Work Order Types ─────────────────────────────────────────────────────────
export interface WorkOrder {
  id: string
  orderNo: string
  projectId: string
  deviceId?: string
  reporterId: string
  assigneeId?: string
  category: string
  priority: string
  status: string
  faultType?: string
  faultDesc: string
  mediaUrls: string[]
  locationDesc?: string
  locationCoord?: { lat: number; lng: number }
  faultAt?: string
  assignedAt?: string
  startedAt?: string
  submittedAt?: string
  closedAt?: string
  slaDeadline?: string
  isOvertime: boolean
  repairCost?: number
  rejectReason?: string
  acceptanceNote?: string
  createdAt: string
  // Joined fields
  device?: Device
  reporter?: User
  assignee?: User
}

// ─── Repair Log Types ─────────────────────────────────────────────────────────
export interface RepairLog {
  id: string
  orderId: string
  engineerId: string
  stepType: string
  stepDesc: string
  photoUrls: string[]
  outsourceVendor?: string
  outsourceCost?: number
  loggedAt: string
  engineer?: User
}

// ─── Spare Part Types ─────────────────────────────────────────────────────────
export interface SparePart {
  id: string
  projectId: string
  name: string
  model?: string
  unit: string
  stock: number
  minStock: number
  unitPrice?: number
  supplier?: string
  supplierPhone?: string
  isLowStock: boolean
}

export interface SparePartLog {
  id: string
  partId: string
  opType: string
  quantity: number
  orderId?: string
  operatorId: string
  note?: string
  createdAt: string
}

// ─── Inspection Types ─────────────────────────────────────────────────────────
export interface InspectionPlan {
  id: string
  projectId: string
  name: string
  frequency: string
  deviceIds: string[]
  assigneeId: string
  nextInspectionAt: string
  isActive: boolean
}

export interface InspectionRecord {
  id: string
  planId: string
  inspectorId: string
  status: string
  resultDesc?: string
  photoUrls: string[]
  orderId?: string
  inspectedAt: string
}

// ─── Notification Types ───────────────────────────────────────────────────────
export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  content: string
  refId?: string
  refType?: string
  isRead: boolean
  createdAt: string
}

// ─── Report Types ─────────────────────────────────────────────────────────────
export interface OrderStats {
  period: string
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byFaultType: Record<string, number>
  avgRepairHours: number
  overtimeRate: number
  slaCompliance: number
}

export interface TrendDataPoint {
  date: string
  value: number
  label?: string
}
