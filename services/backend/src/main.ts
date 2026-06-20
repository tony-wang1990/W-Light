import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

const UNSAFE_PRODUCTION_SECRETS = new Set([
  '',
  'dev_jwt_secret_change_in_production_min_64_chars',
  'minioadmin',
  'redis_dev_pwd',
  'lightops_dev_pwd',
])
const DESKTOP_APP_ORIGIN = 'wlight://app'

function splitOrigins(value?: string) {
  return (value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return

  const secretValues = {
    JWT_SECRET: process.env.JWT_SECRET || '',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
    MINIO_PASSWORD: process.env.MINIO_PASSWORD || '',
  }

  const unsafe = Object.entries(secretValues)
    .filter(([, value]) => value.length < 16 || UNSAFE_PRODUCTION_SECRETS.has(value))
    .map(([key]) => key)

  const minioUser = process.env.MINIO_USER || ''
  if (!minioUser || minioUser === 'minioadmin') unsafe.push('MINIO_USER')

  if (unsafe.length > 0) {
    throw new Error(`Unsafe production secret(s): ${unsafe.join(', ')}`)
  }
}

async function bootstrap() {
  assertProductionSecrets()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })

  app.useBodyParser('json', { limit: '1mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' })
  app.setGlobalPrefix('v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  const configuredOrigins = splitOrigins(process.env.APP_ORIGINS || process.env.APP_ORIGIN)
  const allowedOrigins = [...new Set([DESKTOP_APP_ORIGIN, ...configuredOrigins])]
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Id'],
  })

  const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production'
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('LightOps API')
      .setDescription('W-Light cultural tourism lighting operations API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Project-Id', in: 'header' }, 'project-id')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api-docs', app, document)
  }

  const port = process.env.API_PORT || 3000
  await app.listen(port)
  console.warn(`LightOps API running on http://localhost:${port}/v1`)
  if (enableSwagger) console.warn(`Swagger docs: http://localhost:${port}/api-docs`)
}

bootstrap()
