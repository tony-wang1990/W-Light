import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

export enum StockOpType { INBOUND = 'inbound', OUTBOUND = 'outbound' }

@Entity('spare_part_logs')
export class SparePartLog {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) partId: string
  @Column({ type: 'varchar', enum: StockOpType }) opType: StockOpType
  @Column({ type: 'decimal', precision: 10, scale: 2 }) quantity: number
  @Column({ type: 'uuid', nullable: true }) orderId?: string
  @Column({ type: 'uuid' }) operatorId: string
  @Column({ type: 'text', nullable: true }) note?: string
  @CreateDateColumn() createdAt: Date
}
