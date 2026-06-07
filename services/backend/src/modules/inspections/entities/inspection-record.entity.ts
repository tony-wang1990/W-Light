import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export enum InspectionStatus {
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  SKIPPED = 'skipped',
}

@Entity('inspection_records')
export class InspectionRecord {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) planId: string
  @Column({ type: 'uuid' }) inspectorId: string
  @Column({ default: InspectionStatus.NORMAL }) status: string
  @Column({ type: 'text', nullable: true }) resultDesc: string
  @Column({ type: 'simple-json', default: '[]' }) photoUrls: string[]
  @Column({ type: 'uuid', nullable: true }) orderId: string
  @CreateDateColumn() inspectedAt: Date
}
