import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm'

@Entity('spare_parts')
export class SparePart {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) projectId: string
  @Column({ length: 100 }) name: string
  @Column({ length: 100, nullable: true }) model?: string
  @Column({ length: 20, default: '个' }) unit: string
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) stock: number
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5 }) minStock: number
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) unitPrice?: number
  @Column({ length: 100, nullable: true }) supplier?: string
  @Column({ length: 20, nullable: true }) supplierPhone?: string
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}
