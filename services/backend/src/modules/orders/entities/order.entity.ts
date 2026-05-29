import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm'
import { User } from '../../users/entities/user.entity'
import { Project } from '../../projects/entities/project.entity'
import { Device } from '../../devices/entities/device.entity'

export enum OrderStatus {
  PENDING    = 'pending',     // 待派单
  ASSIGNED   = 'assigned',    // 已派单
  PROCESSING = 'processing',  // 处理中
  SUSPENDED  = 'suspended',   // 已挂起
  REVIEWING  = 'reviewing',   // 待验收
  CLOSED     = 'closed',      // 已完成
  REJECTED   = 'rejected',    // 已取消
}

export enum OrderPriority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum OrderCategory {
  FAULT        = '故障维修',
  MAINTENANCE  = '定期保养',
  INSTALLATION = '设备安装',
  EMERGENCY    = '紧急抢修',
  INSPECTION   = '巡检',
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index({ unique: true })
  @Column({ length: 30 })
  orderNo: string

  @Column()
  projectId: string

  @ManyToOne(() => Project, { eager: false })
  @JoinColumn({ name: 'projectId' })
  project: Project

  @Column({ nullable: true })
  deviceId?: string

  @ManyToOne(() => Device, { nullable: true, eager: false })
  @JoinColumn({ name: 'deviceId' })
  device?: Device

  @Column()
  reporterId: string

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'reporterId' })
  reporter: User

  @Column({ nullable: true })
  assigneeId?: string

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigneeId' })
  assignee?: User

  @Column({ type: 'enum', enum: OrderCategory, default: OrderCategory.FAULT })
  category: OrderCategory

  @Column({ type: 'enum', enum: OrderPriority, default: OrderPriority.P2 })
  priority: OrderPriority

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus

  @Column({ length: 50, nullable: true })
  faultType?: string

  @Column({ type: 'text' })
  faultDesc: string

  @Column({ type: 'jsonb', default: '[]' })
  mediaUrls: string[]

  @Column({ length: 200, nullable: true })
  locationDesc?: string

  @Column({ type: 'timestamptz', nullable: true })
  faultAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  closedAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  slaDeadline?: Date

  @Column({ default: false })
  isOvertime: boolean

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  repairCost?: number

  @Column({ type: 'text', nullable: true })
  rejectReason?: string

  @Column({ type: 'text', nullable: true })
  acceptanceNote?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
