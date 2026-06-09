import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventEmitterModule } from '@nestjs/event-emitter'

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

    // 事件总线
    EventEmitterModule.forRoot(),

    // TypeORM 数据库连接
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DB_TYPE', 'postgres')
        const isDevelopment = config.get<string>('NODE_ENV') === 'development'
        const entities = [__dirname + '/modules/**/*.entity{.ts,.js}']
        const migrations = [__dirname + '/database/migrations/[0-9]*-*{.ts,.js}']
        const synchronize = config.get<string>(
          'DB_SYNCHRONIZE',
          dbType === 'sqlite' && isDevelopment ? 'true' : 'false',
        ) === 'true'
        const logging = config.get<string>('DB_LOGGING', isDevelopment ? 'true' : 'false') === 'true'
        
        if (dbType === 'sqlite') {
          return {
            type: 'sqlite',
            database: config.get<string>('DB_DATABASE', 'lightops.sqlite'),
            entities,
            migrations,
            synchronize,
            logging,
          }
        }

        if (dbType === 'sqljs') {
          return {
            type: 'sqljs',
            entities,
            migrations,
            synchronize,
            logging,
          }
        }
        
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          database: config.get<string>('DB_NAME', 'lightops'),
          username: config.get<string>('DB_USER', 'lightops'),
          password: config.get<string>('DB_PASSWORD', ''),
          entities,
          migrations,
          migrationsRun: config.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true',
          synchronize,
          logging,
          ssl: config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        }
      },
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
