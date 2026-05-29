// ─── Order Status ──────────────────────────────────────────────────────────────
export enum OrderStatus {
  PENDING    = 'pending',     // 待派单
  ASSIGNED   = 'assigned',    // 已派单
  PROCESSING = 'processing',  // 处理中
  SUSPENDED  = 'suspended',   // 已挂起
  REVIEWING  = 'reviewing',   // 待验收
  CLOSED     = 'closed',      // 已完成
  REJECTED   = 'rejected',    // 已取消
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]:    '待派单',
  [OrderStatus.ASSIGNED]:   '已派单',
  [OrderStatus.PROCESSING]: '处理中',
  [OrderStatus.SUSPENDED]:  '已挂起',
  [OrderStatus.REVIEWING]:  '待验收',
  [OrderStatus.CLOSED]:     '已完成',
  [OrderStatus.REJECTED]:   '已取消',
}

// ─── Order Priority ────────────────────────────────────────────────────────────
export enum OrderPriority {
  P0 = 'P0', // 紧急 — 演出期间
  P1 = 'P1', // 高   — 设备停工
  P2 = 'P2', // 中   — 功能降级
  P3 = 'P3', // 低   — 轻微问题
}

export const ORDER_PRIORITY_LABEL: Record<OrderPriority, string> = {
  [OrderPriority.P0]: 'P0 紧急',
  [OrderPriority.P1]: 'P1 高',
  [OrderPriority.P2]: 'P2 中',
  [OrderPriority.P3]: 'P3 低',
}

// ─── SLA Rules (hours) ────────────────────────────────────────────────────────
export const SLA_RULES: Record<OrderPriority, { assignHours: number; responseHours: number; completeHours: number }> = {
  [OrderPriority.P0]: { assignHours: 0.25,  responseHours: 0.5,  completeHours: 2   },
  [OrderPriority.P1]: { assignHours: 1,     responseHours: 2,    completeHours: 8   },
  [OrderPriority.P2]: { assignHours: 4,     responseHours: 8,    completeHours: 24  },
  [OrderPriority.P3]: { assignHours: 24,    responseHours: 48,   completeHours: 168 },
}

// ─── Order Category ────────────────────────────────────────────────────────────
export enum OrderCategory {
  FAULT       = '故障维修',
  MAINTENANCE = '定期保养',
  INSTALLATION = '设备安装',
  EMERGENCY   = '紧急抢修',
  INSPECTION  = '巡检',
}

// ─── Fault Types ──────────────────────────────────────────────────────────────
export enum FaultType {
  NO_LIGHT      = '不亮',
  FLICKERING    = '频闪',
  UNCONTROLLED  = '不受控',
  LEAKAGE       = '漏电',
  PHYSICAL      = '物理损坏',
  OTHER         = '其他',
}

// ─── Device Status ────────────────────────────────────────────────────────────
export enum DeviceStatus {
  NORMAL      = 'normal',
  FAULT       = 'fault',
  MAINTENANCE = 'maintenance',
  OFFLINE     = 'offline',
}

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  [DeviceStatus.NORMAL]:      '正常',
  [DeviceStatus.FAULT]:       '故障',
  [DeviceStatus.MAINTENANCE]: '维护中',
  [DeviceStatus.OFFLINE]:     '离线',
}

// ─── Device Category ──────────────────────────────────────────────────────────
export enum DeviceCategory {
  LIGHT        = '灯具',
  CONSOLE      = '控台',
  DISTRIBUTION = '配电',
  AUDIO        = '音频',
  VIDEO        = '视频',
  OTHER        = '其他',
}

// ─── User Roles ───────────────────────────────────────────────────────────────
export enum UserRole {
  ADMIN     = 'admin',      // 管理员
  ENGINEER  = 'engineer',   // 灯光工程师
  INSPECTOR = 'inspector',  // 巡检员
  VIEWER    = 'viewer',     // 只读查看
}

// ─── Repair Log Step Types ────────────────────────────────────────────────────
export enum RepairStepType {
  CHECK     = '检查',
  DISMANTLE = '拆卸',
  REPLACE   = '更换',
  TEST      = '测试',
  FIX       = '修复',
  RECORD    = '记录',
}

// ─── Notification Types ───────────────────────────────────────────────────────
export enum NotificationType {
  NEW_ORDER     = 'new_order',
  ASSIGNED      = 'assigned',
  OVERTIME      = 'overtime',
  INSPECTION    = 'inspection',
  STOCK_ALERT   = 'stock_alert',
  REVIEW_RESULT = 'review_result',
  CONTRACT_EXPIRE = 'contract_expire',
}

// ─── Project Status ───────────────────────────────────────────────────────────
export enum ProjectStatus {
  ACTIVE      = 'active',
  CLOSED      = 'closed',
  MAINTENANCE = 'maintenance',
}

// ─── Inspection Status ────────────────────────────────────────────────────────
export enum InspectionStatus {
  NORMAL   = 'normal',
  ABNORMAL = 'abnormal',
  SKIPPED  = 'skipped',
}

export enum InspectionFrequency {
  DAILY   = 'daily',
  WEEKLY  = 'weekly',
  MONTHLY = 'monthly',
}

// ─── Stock Operation Types ────────────────────────────────────────────────────
export enum StockOpType {
  INBOUND  = 'inbound',   // 入库
  OUTBOUND = 'outbound',  // 出库
}
