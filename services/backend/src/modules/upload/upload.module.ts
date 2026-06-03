import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import * as Minio from 'minio'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ProjectAccessGuard } from '../../common/guards/project-access.guard'
import { v4 as uuid } from 'uuid'
import * as path from 'path'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const DOWNLOADABLE_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES])

interface FileResponse extends NodeJS.WritableStream {
  headersSent?: boolean
  setHeader(name: string, value: string): void
  status(code: number): { end(): void }
}

function fileTypeFilter(allowedTypes: Set<string>, label: string) {
  return (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new BadRequestException(`Unsupported ${label} file type`), false)
      return
    }
    callback(null, true)
  }
}

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

  async upload(buffer: Buffer, originalName: string, mimetype: string, projectId: string): Promise<string> {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) await this.client.makeBucket(this.bucket)

    const ext = path.extname(originalName).toLowerCase()
    const objectName = `projects/${projectId}/uploads/${new Date().getFullYear()}/${uuid()}${ext}`
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, { 'Content-Type': mimetype })
    return `/v1/files/${objectName}`
  }

  async streamObject(objectName: string, res: FileResponse) {
    try {
      const stat = await this.client.statObject(this.bucket, objectName)
      const contentType = String(stat.metaData?.['content-type'] || stat.metaData?.['Content-Type'] || 'application/octet-stream')
      if (!DOWNLOADABLE_MIME_TYPES.has(contentType)) {
        throw new ForbiddenException('Unsupported attachment type')
      }

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', String(stat.size))
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(objectName)}"`)
      res.setHeader('Cache-Control', 'private, max-age=300')

      const stream = await this.client.getObject(this.bucket, objectName)
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end()
      })
      stream.pipe(res)
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      throw new NotFoundException('Attachment not found')
    }
  }
}

@ApiTags('文件上传')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('upload')
class UploadController {
  constructor(private readonly minioService: MinioService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileTypeFilter(IMAGE_MIME_TYPES, 'image'),
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file?.buffer) throw new BadRequestException('请选择要上传的图片')
    const url = await this.minioService.upload(file.buffer, file.originalname, file.mimetype, req.projectId)
    return { url }
  }

  @Post('video')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: fileTypeFilter(VIDEO_MIME_TYPES, 'video'),
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file?.buffer) throw new BadRequestException('请选择要上传的视频')
    const url = await this.minioService.upload(file.buffer, file.originalname, file.mimetype, req.projectId)
    return { url }
  }
}

@ApiTags('附件访问')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('files')
class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Get('projects/:projectId/uploads/:year/:fileName')
  async getProjectFile(
    @Param('projectId') projectId: string,
    @Param('year') year: string,
    @Param('fileName') fileName: string,
    @Request() req,
    @Res() res: FileResponse,
  ) {
    if (projectId !== req.projectId) {
      throw new ForbiddenException('No access to this attachment')
    }
    if (!/^\d{4}$/.test(year) || fileName.includes('/') || fileName.includes('\\')) {
      throw new BadRequestException('Invalid attachment path')
    }

    return this.minioService.streamObject(`projects/${projectId}/uploads/${year}/${fileName}`, res)
  }
}

@Module({
  controllers: [UploadController, FilesController],
  providers: [MinioService],
  exports: [MinioService],
})
export class UploadModule {}
