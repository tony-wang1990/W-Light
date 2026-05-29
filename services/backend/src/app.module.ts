import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bull'

// Feature Modules
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { DevicesModule } from './modules/devices/devices.module'
import { OrdersModule } from './modules/orders/orders.module'
import { PartsModule } from './modules/parts/parts.module'
import { InspectionsModule } from './modules/inspections/inspections.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { UploadModule } from './modules/upload/upload.module'
import { ReportsModule } from './modules/reports/reports.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    // 配置模块（从 .env 文件读取）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development', '.env.production'],
    }),

    // TypeORM 数据库连接
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get<string>('DB_NAME', 'lightops'),
        username: config.get<string>('DB_USER', 'lightops'),
        password: config.get<string>('DB_PASSWORD', ''),
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        synchronize: config.get<string>('NODE_ENV') === 'development', // 生产环境禁用！使用迁移
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // BullMQ Redis 队列
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', ''),
        },
      }),
      inject: [ConfigService],
    }),

    // 功能模块
    AuthModule,
    UsersModule,
    ProjectsModule,
    DevicesModule,
    OrdersModule,
    PartsModule,
    InspectionsModule,
    NotificationsModule,
    UploadModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
