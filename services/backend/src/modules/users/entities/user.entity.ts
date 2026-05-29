import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'

export enum UserRole {
  ADMIN     = 'admin',
  ENGINEER  = 'engineer',
  INSPECTOR = 'inspector',
  VIEWER    = 'viewer',
}

@Entity('users')
export class User {
  @ApiProperty({ description: '用户唯一ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty({ description: '姓名' })
  @Column({ length: 50 })
  name: string

  @ApiProperty({ description: '手机号（登录账号）' })
  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string

  @Column({ length: 255 })
  passwordHash: string

  @ApiProperty({ enum: UserRole, description: '角色' })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.ENGINEER })
  role: UserRole

  @ApiProperty({ description: '可访问的项目ID列表' })
  @Column({ type: 'jsonb', default: '[]' })
  projectIds: string[]

  @ApiProperty({ description: '技能标签' })
  @Column({ type: 'jsonb', default: '[]' })
  skillTags: string[]

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  avatarUrl?: string

  @Column({ nullable: true })
  fcmToken?: string

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
