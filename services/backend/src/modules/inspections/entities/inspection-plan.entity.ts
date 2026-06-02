import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export enum InspectionFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('inspection_plans')
export class InspectionPlan {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() projectId: string
  @Column({ length: 100 }) name: string
  @Column({ default: InspectionFrequency.DAILY }) frequency: string
  @Column({ type: 'simple-json', default: '[]' }) deviceIds: string[]
  @Column({ nullable: true }) assigneeId: string
  @Column({ nullable: true }) nextInspectionAt: Date
  @Column({ default: 1 }) isActive: number
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}
