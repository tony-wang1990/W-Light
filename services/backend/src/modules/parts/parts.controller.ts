import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PartsService } from './parts.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { SparePart } from './entities/spare-part.entity'

@ApiTags('备件库存')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parts')
export class PartsController {
  constructor(private readonly svc: PartsService) {}

  @Post()
  create(@Body() dto: Partial<SparePart>) { return this.svc.create(dto) }

  @Get()
  findAll(@Request() req, @Query('lowStockOnly') lowStockOnly?: string) {
    return this.svc.findAll(req.headers['x-project-id'], lowStockOnly === 'true')
  }

  @Get('low-stock-alerts')
  alerts(@Request() req) { return this.svc.getLowStockAlerts(req.headers['x-project-id']) }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<SparePart>) { return this.svc.update(id, dto) }

  @Post(':id/inbound')
  @ApiOperation({ summary: '入库' })
  inbound(@Param('id') id: string, @Body() body: { quantity: number; note?: string }, @Request() req) {
    return this.svc.inbound(id, body.quantity, req.user.id, body.note)
  }

  @Post(':id/outbound')
  @ApiOperation({ summary: '出库' })
  outbound(@Param('id') id: string, @Body() body: { quantity: number; orderId?: string; note?: string }, @Request() req) {
    return this.svc.outbound(id, body.quantity, req.user.id, body.orderId, body.note)
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '出入库记录' })
  getLogs(@Param('id') id: string) { return this.svc.getLogs(id) }
}
