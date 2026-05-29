import { Module, Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import * as Minio from 'minio'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { v4 as uuid } from 'uuid'
import * as path from 'path'

@Injectable()
class MinioService {
  private client: Minio.Client
  private bucket: string

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get('MINIO_PORT', 9000)),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_USER', 'minioadmin'),
      secretKey: config.get('MINIO_PASSWORD', 'minioadmin'),
    })
    this.bucket = config.get('MINIO_BUCKET', 'lightops-files')
  }

  async upload(buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
    const ext = path.extname(originalName)
    const objectName = `uploads/${new Date().getFullYear()}/${uuid()}${ext}`
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, { 'Content-Type': mimetype })
    return `/${this.bucket}/${objectName}`
  }
}

@ApiTags('文件上传')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
class UploadController {
  constructor(private readonly minioService: MinioService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.minioService.upload(file.buffer, file.originalname, file.mimetype)
    return { url }
  }

  @Post('video')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const url = await this.minioService.upload(file.buffer, file.originalname, file.mimetype)
    return { url }
  }
}

@Module({
  controllers: [UploadController],
  providers: [MinioService],
  exports: [MinioService],
})
export class UploadModule {}
