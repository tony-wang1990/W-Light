import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { DevicesService } from './devices.service'

/**
 * 公开设备查询接口（无需登录，用于二维码扫码场景）
 */
@ApiTags('设备扫码（公开）')
@Controller('public/devices')
export class DevicesPublicController {
  constructor(private readonly svc: DevicesService) {}

  @Get('scan/:qrCode')
  @ApiOperation({ summary: '扫码查询设备基本信息（无需鉴权）' })
  scan(@Param('qrCode') qrCode: string) {
    return this.svc.findByQrCode(qrCode)
  }
}
