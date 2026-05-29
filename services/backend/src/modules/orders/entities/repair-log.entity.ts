import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm'
import { WorkOrder } from './order.entity'
import { User } from '../../users/entities/user.entity'

@Entity('repair_logs')
export class RepairLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  orderId: string

  @ManyToOne(() => WorkOrder, { eager: false })
  @JoinColumn({ name: 'orderId' })
  order: WorkOrder

  @Column()
  engineerId: string

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'engineerId' })
  engineer: User

  @Column({ length: 50 })
  stepType: string

  @Column({ type: 'text' })
  stepDesc: string

  @Column({ type: 'simple-json', default: '[]' })
  photoUrls: string[]

  @Column({ length: 100, nullable: true })
  outsourceVendor?: string

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  outsourceCost?: number

  @CreateDateColumn()
  loggedAt: Date
}
