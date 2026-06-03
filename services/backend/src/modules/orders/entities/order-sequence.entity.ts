import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm'

@Entity('work_order_sequences')
export class WorkOrderSequence {
  @PrimaryColumn({ length: 8 })
  dateKey: string

  @Column({ type: 'int', default: 0 })
  value: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
