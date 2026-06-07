import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm'
import { User } from '../../users/entities/user.entity'

export enum ProjectStatus {
  ACTIVE      = 'active',
  CLOSED      = 'closed',
  MAINTENANCE = 'maintenance',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @Column({ length: 100, nullable: true })
  venue?: string

  @Column({ type: 'text', nullable: true })
  address?: string

  @Column({ type: 'uuid', nullable: true })
  managerId?: string

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'managerId' })
  manager?: User

  @Column({ type: 'varchar', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
