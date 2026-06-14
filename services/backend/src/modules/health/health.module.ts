import { Controller, Get, Module } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { ApiTags } from '@nestjs/swagger'
import { DataSource } from 'typeorm'

type HealthStatus = 'ok' | 'degraded'

@ApiTags('System Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return this.baseStatus('ok')
  }

  @Get('ready')
  async ready() {
    const checks = {
      api: 'ok',
      database: 'ok',
    }

    try {
      await this.dataSource.query('SELECT 1')
    } catch {
      checks.database = 'error'
    }

    const status: HealthStatus = checks.database === 'ok' ? 'ok' : 'degraded'
    return {
      ...this.baseStatus(status),
      checks,
    }
  }

  private baseStatus(status: HealthStatus) {
    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown',
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
