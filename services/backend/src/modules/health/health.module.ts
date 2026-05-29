import { Module } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('系统健康')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) + 's' }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
