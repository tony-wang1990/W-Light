import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ProjectAccessGuard } from '../../common/guards/project-access.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '../users/entities/user.entity'
import { Device } from './entities/device.entity'
import { DevicesService } from './devices.service'

@ApiTags('设备台账')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly svc: DevicesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '新增设备' })
  create(@Body() dto: Partial<Device>, @Request() req) {
    return this.svc.create({ ...dto, projectId: req.projectId })
  }

  @Post('batch-import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '批量导入设备' })
  batchImport(@Body() body: { devices: Partial<Device>[] }, @Request() req) {
    return this.svc.batchImport(body.devices, req.projectId)
  }

  @Get()
  @ApiOperation({ summary: '设备列表' })
  findAll(
    @Request() req,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.svc.findAll(req.projectId, category, status, keyword)
  }

  @Get('scan/:qrCode')
  @ApiOperation({ summary: '扫码识别设备' })
  scan(@Param('qrCode') qrCode: string, @Request() req) {
    return this.svc.getDeviceForOrder(qrCode, req.projectId)
  }

  @Get(':id')
  @ApiOperation({ summary: '设备详情' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.svc.findOne(id, req.projectId)
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新设备信息' })
  update(@Param('id') id: string, @Body() dto: Partial<Device>, @Request() req) {
    return this.svc.update(id, dto, req.projectId)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除设备' })
  remove(@Param('id') id: string, @Request() req) {
    return this.svc.remove(id, req.projectId)
  }
}
