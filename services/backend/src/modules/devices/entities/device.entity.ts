import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm'
import { Project } from '../../projects/entities/project.entity'

export enum DeviceStatus {
  NORMAL      = 'normal',
  FAULT       = 'fault',
  MAINTENANCE = 'maintenance',
  OFFLINE     = 'offline',
}

export enum DeviceCategory {
  LIGHT        = '灯具',
  CONSOLE      = '控台',
  DISTRIBUTION = '配电',
  AUDIO        = '音频',
  VIDEO        = '视频',
  OTHER        = '其他',
}

@Index('IDX_devices_project_deviceNo_unique', ['projectId', 'deviceNo'], { unique: true })
@Index('IDX_devices_project_qrCode_unique', ['projectId', 'qrCode'], { unique: true })
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  projectId: string

  @ManyToOne(() => Project, { eager: false })
  @JoinColumn({ name: 'projectId' })
  project: Project

  @Column({ length: 50 })
  deviceNo: string

  @Column({ length: 100 })
  name: string

  @Column({ type: 'varchar', enum: DeviceCategory, default: DeviceCategory.LIGHT })
  category: DeviceCategory

  @Column({ length: 100, nullable: true })
  model?: string

  @Column({ length: 100, nullable: true })
  manufacturer?: string

  @Column({ length: 200, nullable: true })
  location?: string

  @Column({ length: 100 })
  qrCode: string

  @Column({ type: 'int', nullable: true })
  dmxAddress?: number

  @Column({ type: 'int', nullable: true })
  channelCount?: number

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  power?: number

  @Column({ type: 'date', nullable: true })
  warrantyExpire?: string

  @Column({ type: 'date', nullable: true })
  installDate?: string

  @Column({ type: 'varchar', enum: DeviceStatus, default: DeviceStatus.NORMAL })
  status: DeviceStatus

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  healthScore: number

  @Column({ nullable: true })
  lastMaintainAt?: Date

  @Column({ nullable: true })
  manualUrl?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
