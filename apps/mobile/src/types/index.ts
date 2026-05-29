// ─── Types for mobile app ─────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  phone: string
  role: 'admin' | 'engineer' | 'inspector' | 'viewer'
  projectIds: string[]
  skillTags: string[]
  avatarUrl?: string
}

export interface Project {
  id: string
  name: string
  venue?: string
  address?: string
  status: 'active' | 'closed' | 'maintenance'
}

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
  status: 'normal' | 'fault' | 'maintenance' | 'offline'
  healthScore: number
}

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'processing'
  | 'suspended'
  | 'reviewing'
  | 'closed'
  | 'rejected'

export type OrderPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface WorkOrder {
  id: string
  orderNo: string
  projectId: string
  deviceId?: string
  reporterId: string
  assigneeId?: string
  category: string
  priority: OrderPriority
  status: OrderStatus
  faultType?: string
  faultDesc: string
  mediaUrls: string[]
  locationDesc?: string
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
  // Joined
  device?: Device
  reporter?: User
  assignee?: User
}

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
}

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

// Navigation param types
export type RootStackParamList = {
  AuthStack: undefined
  MainTabs: undefined
}

export type AuthStackParamList = {
  Login: undefined
}

export type MainTabParamList = {
  Home: undefined
  Orders: undefined
  Toolbox: undefined
  Records: undefined
  Profile: undefined
}

export type OrderStackParamList = {
  OrderList: undefined
  OrderDetail: { orderId: string }
  OrderCreate: { deviceId?: string; qrCode?: string }
  OrderRepair: { orderId: string }
}

export type ToolboxStackParamList = {
  ToolboxHome: undefined
  Bpm: undefined
  Dmx: undefined
  BeamAngle: undefined
  PowerCalc: undefined
  Diagnosis: undefined
  MaMacros: undefined
  Terms: undefined
  Lux: undefined
}
