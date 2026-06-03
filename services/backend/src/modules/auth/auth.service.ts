import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from '../users/entities/user.entity'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone, isActive: true } })
    if (!user) throw new UnauthorizedException('手机号或密码错误')

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isMatch) throw new UnauthorizedException('手机号或密码错误')

    // 验证项目访问权限
    if (dto.projectId && !user.projectIds.includes(dto.projectId)) {
      throw new UnauthorizedException('您没有访问该项目的权限')
    }

    return this.generateTokens(user)
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone, role: user.role }
    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' })
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' })

    const { passwordHash, fcmToken, ...userInfo } = user
    return { accessToken, refreshToken, user: userInfo }
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken)
      const user = await this.userRepo.findOne({ where: { id: payload.sub } })
      if (!user || !user.isActive) throw new UnauthorizedException('无效的 Token')
      return this.generateTokens(user)
    } catch {
      throw new UnauthorizedException('Token 已失效，请重新登录')
    }
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken })
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()
    const { passwordHash, fcmToken, ...userInfo } = user
    return userInfo
  }
}
