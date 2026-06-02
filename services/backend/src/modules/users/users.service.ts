import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User, UserRole } from './entities/user.entity'

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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.findOne({ where: { phone: dto.phone } })
    if (exists) throw new ConflictException('该手机号已注册')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = this.repo.create({ ...dto, passwordHash })
    return this.repo.save(user)
  }

  async findAll(projectId?: string): Promise<User[]> {
    const users = await this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    })
    if (!projectId) return users
    return users.filter(user => Array.isArray(user.projectIds) && user.projectIds.includes(projectId))
  }

  async findOne(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    return user
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone } })
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id)
    Object.assign(user, dto)
    return this.repo.save(user)
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.repo.update(id, { passwordHash })
  }

  async remove(id: string): Promise<void> {
    await this.repo.update(id, { isActive: false })
  }
}
