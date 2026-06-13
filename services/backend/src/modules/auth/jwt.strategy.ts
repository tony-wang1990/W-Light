import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../users/entities/user.entity'

interface RequestWithQueryToken {
  query?: {
    token?: unknown
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: RequestWithQueryToken) => {
          const token = request?.query?.token
          return typeof token === 'string' ? token : null
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string; phone: string; role: string }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } })
    if (!user) throw new UnauthorizedException('Invalid token user')

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      projectIds: user.projectIds || [],
      isActive: user.isActive,
    }
  }
}
