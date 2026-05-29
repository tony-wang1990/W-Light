import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { AssignOrderDto } from './dto/assign-order.dto'
import { RejectOrderDto } from './dto/reject-order.dto'
import { AddRepairLogDto } from './dto/add-repair-log.dto'
import { SubmitOrderDto } from './dto/submit-order.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { OrderStatus, OrderPriority } from './entities/order.entity'

@ApiTags('工单管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: '创建工单（报修）' })
  create(@Body() dto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(dto, req.user.id, req.headers['x-project-id'])
  }

  @Get()
  @ApiOperation({ summary: '获取工单列表' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'priority', enum: OrderPriority, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'keyword', required: false })
  findAll(
    @Request() req,
    @Query('status') status?: OrderStatus,
    @Query('priority') priority?: OrderPriority,
    @Query('assigneeId') assigneeId?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const projectId = req.headers['x-project-id'] as string
    return this.ordersService.findAll(projectId, +page, +pageSize, status, priority, assigneeId, keyword)
  }

  @Get('summary')
  @ApiOperation({ summary: '获取工单状态统计' })
  getSummary(@Request() req) {
    const projectId = req.headers['x-project-id'] as string
    return this.ordersService.getStatusSummary(projectId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取工单详情' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id)
  }

  @Put(':id/assign')
  @ApiOperation({ summary: '派单（管理员）' })
  assign(@Param('id') id: string, @Body() dto: AssignOrderDto) {
    return this.ordersService.assign(id, dto)
  }

  @Put(':id/accept')
  @ApiOperation({ summary: '接单（工程师）' })
  accept(@Param('id') id: string, @Request() req) {
    return this.ordersService.accept(id, req.user.id)
  }

  @Put(':id/reject')
  @ApiOperation({ summary: '拒单（工程师）' })
  reject(@Param('id') id: string, @Body() dto: RejectOrderDto, @Request() req) {
    return this.ordersService.reject(id, req.user.id, dto.reason)
  }

  @Put(':id/suspend')
  @ApiOperation({ summary: '挂起工单' })
  suspend(@Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.ordersService.suspend(id, dto.reason)
  }

  @Put(':id/resume')
  @ApiOperation({ summary: '恢复工单' })
  resume(@Param('id') id: string) {
    return this.ordersService.resume(id)
  }

  @Put(':id/submit')
  @ApiOperation({ summary: '提交验收（工程师）' })
  submit(@Param('id') id: string, @Body() dto: SubmitOrderDto, @Request() req) {
    return this.ordersService.submit(id, req.user.id, dto.repairCost)
  }

  @Put(':id/accept-check')
  @ApiOperation({ summary: '验收通过（管理员）' })
  acceptCheck(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.ordersService.acceptCheck(id, body.note)
  }

  @Put(':id/reject-check')
  @ApiOperation({ summary: '验收退回（管理员）' })
  rejectCheck(@Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.ordersService.rejectCheck(id, dto.reason)
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: '取消工单（管理员）' })
  cancel(@Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.ordersService.cancel(id, dto.reason)
  }

  @Post(':id/repair-logs')
  @ApiOperation({ summary: '添加维修记录' })
  addRepairLog(@Param('id') id: string, @Body() dto: AddRepairLogDto, @Request() req) {
    return this.ordersService.addRepairLog(id, req.user.id, dto)
  }

  @Get(':id/repair-logs')
  @ApiOperation({ summary: '获取维修记录列表' })
  getRepairLogs(@Param('id') id: string) {
    return this.ordersService.getRepairLogs(id)
  }
}
