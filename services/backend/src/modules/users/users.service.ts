import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User, UserRole } from './entities/user.entity'
import { WorkOrder, OrderStatus } from '../orders/entities/order.entity'

export type UserBusyStatus = 'idle' | 'busy' | 'overloaded'

export interface PublicUser {
  id: string
  name: string
  phone: string
  role: UserRole
  projectIds: string[]
  skillTags: string[]
  avatarUrl?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  activeOrderCount?: number
  busyStatus?: UserBusyStatus
}

export class CreateUserDto {
  name: string
  phone: string
  password: string
  role?: UserRole
  projectIds?: string[]
  skillTags?: string[]
}

export class UpdateUserDto {
  name?: string
  phone?: string
  role?: UserRole
  projectIds?: string[]
  skillTags?: string[]
  isActive?: boolean
}

interface RequestUserScope {
  role: UserRole
  projectIds?: string[]
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(WorkOrder)
    private readonly orderRepo: Repository<WorkOrder>,
  ) {}

  private toPublicUser(user: User, workload?: number): PublicUser {
    const { passwordHash, fcmToken, ...safeUser } = user
    if (workload === undefined) return safeUser

    return {
      ...safeUser,
      activeOrderCount: workload,
      busyStatus: workload === 0 ? 'idle' : workload >= 3 ? 'overloaded' : 'busy',
    }
  }

  private async getWorkloadByUser(projectId: string, userIds: string[]): Promise<Map<string, number>> {
    if (!projectId || userIds.length === 0) return new Map()

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o."assigneeId"', 'assigneeId')
      .addSelect('COUNT(o.id)', 'count')
      .where('o."projectId" = :projectId', { projectId })
      .andWhere('o."assigneeId" IN (:...userIds)', { userIds })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.ASSIGNED,
          OrderStatus.PROCESSING,
          OrderStatus.SUSPENDED,
          OrderStatus.REVIEWING,
        ],
      })
      .groupBy('o."assigneeId"')
      .getRawMany<{ assigneeId: string; count: string }>()

    return new Map(rows.map(row => [row.assigneeId, Number(row.count)]))
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const exists = await this.repo.findOne({ where: { phone: dto.phone } })
    if (exists) throw new ConflictException('该手机号已注册')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = this.repo.create({ ...dto, passwordHash })
    return this.toPublicUser(await this.repo.save(user))
  }

  async findAll(projectId?: string, includeWorkload = false, requester?: RequestUserScope): Promise<PublicUser[]> {
    const users = await this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    })
    const allowedProjectIds = requester?.role === UserRole.ADMIN
      ? null
      : new Set(requester?.projectIds || [])
    const scopedUsers = projectId
      ? users.filter(user => Array.isArray(user.projectIds) && user.projectIds.includes(projectId))
      : users
    const visibleUsers = allowedProjectIds
      ? scopedUsers.filter(user => user.projectIds?.some(project => allowedProjectIds.has(project)))
      : scopedUsers

    if (!includeWorkload || !projectId) return visibleUsers.map(user => this.toPublicUser(user))

    const workloadByUser = await this.getWorkloadByUser(projectId, visibleUsers.map(user => user.id))
    return visibleUsers.map(user => this.toPublicUser(user, workloadByUser.get(user.id) || 0))
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.repo.findOne({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    return this.toPublicUser(user)
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone } })
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.repo.findOne({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    Object.assign(user, dto)
    return this.toPublicUser(await this.repo.save(user))
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.repo.update(id, { passwordHash })
  }

  async remove(id: string): Promise<void> {
    await this.repo.update(id, { isActive: false })
  }
}
