import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) userId: string
  @Column({ length: 50 }) type: string
  @Column({ length: 100 }) title: string
  @Column({ type: 'text' }) content: string
  @Column({ nullable: true }) refId?: string
  @Column({ length: 50, nullable: true }) refType?: string
  @Column({ default: false }) isRead: boolean
  @CreateDateColumn() createdAt: Date
}
