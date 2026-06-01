import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { DevicesService } from './devices.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Device } from './entities/device.entity'

@ApiTags('设备台账')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly svc: DevicesService) {}

  @Post()
  @ApiOperation({ summary: '新增设备' })
  create(@Body() dto: Partial<Device>, @Request() req) { 
    return this.svc.create({ ...dto, projectId: req.headers['x-project-id'] }) 
  }

  @Post('batch-import')
  @ApiOperation({ summary: '批量导入设备' })
  batchImport(@Body() body: { devices: Partial<Device>[] }, @Request() req) {
    return this.svc.batchImport(body.devices, req.headers['x-project-id'])
  }

  @Get()
  @ApiOperation({ summary: '设备列表' })
  findAll(
    @Request() req,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.svc.findAll(req.headers['x-project-id'], category, status, keyword)
  }

  @Get('scan/:qrCode')
  @ApiOperation({ summary: '扫码识别设备' })
  scan(@Param('qrCode') qrCode: string) { return this.svc.getDeviceForOrder(qrCode) }

  @Get(':id')
  @ApiOperation({ summary: '设备详情' })
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Put(':id')
  @ApiOperation({ summary: '更新设备信息' })
  update(@Param('id') id: string, @Body() dto: Partial<Device>) { return this.svc.update(id, dto) }

  @Delete(':id')
  @ApiOperation({ summary: '删除设备' })
  remove(@Param('id') id: string) { return this.svc.remove(id) }
}
