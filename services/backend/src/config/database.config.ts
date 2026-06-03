import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isDevelopment = configService.get<string>('NODE_ENV') === 'development';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    database: configService.get<string>('DB_NAME', 'lightops'),
    username: configService.get<string>('DB_USER', 'lightops'),
    password: configService.get<string>('DB_PASSWORD', 'lightops_dev_pwd'),
    entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true',
    synchronize: configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
    logging: configService.get<string>('DB_LOGGING', isDevelopment ? 'true' : 'false') === 'true',
    ssl:
      configService.get<string>('DB_SSL') === 'true'
        ? { rejectUnauthorized: false }
        : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
};
