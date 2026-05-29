import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 全局前缀
  app.setGlobalPrefix('v1')

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Id'],
  })

  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('LightOps API')
    .setDescription('文旅灯光运维一体化APP — 后端接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Project-Id', in: 'header' }, 'project-id')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api-docs', app, document)

  const port = process.env.API_PORT || 3000
  await app.listen(port)
  console.warn(`🚀 LightOps API running on http://localhost:${port}/v1`)
  console.warn(`📖 Swagger docs: http://localhost:${port}/api-docs`)
}

bootstrap()
