import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ProjectAccessGuard } from '../../common/guards/project-access.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UserRole } from '../users/entities/user.entity'
import { SparePart } from './entities/spare-part.entity'
import { PartsService } from './parts.service'

@ApiTags('备件库存')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard)
@Controller('parts')
export class PartsController {
  constructor(private readonly svc: PartsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: Partial<SparePart>, @Request() req) {
    return this.svc.create({ ...dto, projectId: req.projectId })
  }

  @Get()
  findAll(
    @Request() req,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.svc.findAll(req.projectId, lowStockOnly === 'true', keyword)
  }

  @Get('low-stock-alerts')
  alerts(@Request() req) {
    return this.svc.getLowStockAlerts(req.projectId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.svc.findOne(id, req.projectId)
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<SparePart>, @Request() req) {
    return this.svc.update(id, dto, req.projectId)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Request() req) {
    return this.svc.remove(id, req.projectId)
  }

  @Post(':id/inbound')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '入库' })
  inbound(@Param('id') id: string, @Body() body: { quantity: number; note?: string }, @Request() req) {
    return this.svc.inbound(id, body.quantity, req.user.id, body.note, undefined, req.projectId)
  }

  @Post(':id/outbound')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER)
  @ApiOperation({ summary: '出库' })
  outbound(
    @Param('id') id: string,
    @Body() body: { quantity: number; orderId?: string; note?: string },
    @Request() req,
  ) {
    return this.svc.outbound(id, body.quantity, req.user.id, body.orderId, body.note, undefined, req.projectId)
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '出入库记录' })
  getLogs(@Param('id') id: string, @Request() req) {
    return this.svc.getLogs(id, req.projectId)
  }
}
