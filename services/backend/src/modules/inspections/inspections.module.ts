import { Module, Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { OrdersModule } from '../orders/orders.module'
import { OrdersService } from '../orders/orders.service'
import { OrderCategory, OrderPriority } from '../orders/entities/order.entity'

export enum InspectionFrequency { DAILY = 'daily', WEEKLY = 'weekly', MONTHLY = 'monthly' }
export enum InspectionStatus { NORMAL = 'normal', ABNORMAL = 'abnormal', SKIPPED = 'skipped' }

interface CreateInspectionRecordPayload extends Partial<InspectionRecord> {
  createOrder?: boolean
}

@Entity('inspection_plans')
export class InspectionPlan {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() projectId: string
  @Column({ length: 100 }) name: string
  // SQLite 兼容：使用 varchar 替代 enum
  @Column({ default: InspectionFrequency.DAILY }) frequency: string
  // SQLite 兼容：使用 simple-json 替代 jsonb
  @Column({ type: 'simple-json', default: '[]' }) deviceIds: string[]
  @Column({ nullable: true }) assigneeId: string
  @Column({ nullable: true }) nextInspectionAt: Date
  @Column({ default: 1 }) isActive: number  // SQLite 无布尔值，用 0/1
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}

@Entity('inspection_records')
export class InspectionRecord {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() planId: string
  @Column() inspectorId: string
  // SQLite 兼容：使用 varchar 替代 enum
  @Column({ default: InspectionStatus.NORMAL }) status: string
  @Column({ type: 'text', nullable: true }) resultDesc: string
  // SQLite 兼容：使用 simple-json 替代 jsonb
  @Column({ type: 'simple-json', default: '[]' }) photoUrls: string[]
  @Column({ nullable: true }) orderId: string
  @CreateDateColumn() inspectedAt: Date
}

@Injectable()
class InspectionsService {
  constructor(
    @InjectRepository(InspectionPlan) private planRepo: Repository<InspectionPlan>,
    @InjectRepository(InspectionRecord) private recordRepo: Repository<InspectionRecord>,
    private readonly ordersService: OrdersService,
  ) {}

  createPlan(dto: Partial<InspectionPlan>) { return this.planRepo.save(this.planRepo.create(dto)) }
  
  updatePlan(id: string, dto: Partial<InspectionPlan>) { return this.planRepo.update(id, dto) }
  
  deletePlan(id: string) { return this.planRepo.delete(id) }

  getPlans(projectId: string) { return this.planRepo.find({ where: { projectId, isActive: 1 } }) }
  
  private getNextInspectionAt(current: Date, frequency: string) {
    const next = new Date(current)
    if (frequency === InspectionFrequency.WEEKLY) next.setDate(next.getDate() + 7)
    else if (frequency === InspectionFrequency.MONTHLY) next.setMonth(next.getMonth() + 1)
    else next.setDate(next.getDate() + 1)
    return next
  }

  async createRecord(dto: CreateInspectionRecordPayload, inspectorId: string, projectId: string) {
    const { createOrder, ...recordDto } = dto
    const plan = dto.planId ? await this.planRepo.findOne({ where: { id: dto.planId } }) : null
    const shouldCreateOrder = createOrder && dto.status === InspectionStatus.ABNORMAL
    let orderId = dto.orderId

    if (shouldCreateOrder) {
      const linkedDeviceId = plan?.deviceIds?.length === 1 ? plan.deviceIds[0] : undefined
      const order = await this.ordersService.create({
        deviceId: linkedDeviceId,
        category: OrderCategory.FAULT,
        priority: OrderPriority.P2,
        faultType: '巡检异常',
        faultDesc: `${plan?.name ? `巡检计划「${plan.name}」` : '巡检'}发现异常：${dto.resultDesc || '需现场处理'}`,
        locationDesc: plan?.name,
        faultAt: new Date().toISOString(),
      }, inspectorId, projectId)
      orderId = order.id
    }

    const record = await this.recordRepo.save(this.recordRepo.create({
      ...recordDto,
      inspectorId,
      orderId,
    }))

    if (plan) {
      plan.nextInspectionAt = this.getNextInspectionAt(new Date(), plan.frequency)
      await this.planRepo.save(plan)
    }

    return record
  }
  
  async getRecords(projectId: string, planId?: string, page = 1, ps = 20) {
    const qb = this.recordRepo
      .createQueryBuilder('r')
      .innerJoin(InspectionPlan, 'p', 'p.id = r.planId AND p.projectId = :projectId', { projectId })
      .orderBy('r.inspectedAt', 'DESC')

    if (planId) qb.andWhere('r.planId = :planId', { planId })

    const [items, total] = await qb
      .skip((page - 1) * ps)
      .take(ps)
      .getManyAndCount()

    return { items, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
  }
  
  getTodayPlans(assigneeId: string, projectId: string) {
    return this.planRepo
      .createQueryBuilder('p')
      .where('p.projectId = :projectId', { projectId })
      .andWhere('p.isActive = :isActive', { isActive: 1 })
      .andWhere('(p.assigneeId = :assigneeId OR p.assigneeId IS NULL)', { assigneeId })
      .andWhere('(p.nextInspectionAt IS NULL OR p.nextInspectionAt <= :now)', { now: new Date() })
      .orderBy('p.nextInspectionAt', 'ASC')
      .getMany()
  }
  
  async getStats(projectId: string) {
    const total = await this.planRepo.count({ where: { projectId, isActive: 1 } })
    const plans = await this.planRepo.find({ where: { projectId, isActive: 1 }, select: ['id'] })
    const planIds = plans.map(plan => plan.id)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const todayRecords = planIds.length === 0
      ? 0
      : await this.recordRepo
        .createQueryBuilder('r')
        .where('r.planId IN (:...planIds)', { planIds })
        .andWhere('r.inspectedAt >= :start', { start })
        .andWhere('r.inspectedAt < :end', { end })
        .getCount()
    return { totalPlans: total, todayRecords }
  }
}

@ApiTags('巡检管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
class InspectionsController {
  constructor(private readonly svc: InspectionsService) {}

  @Post('plans') createPlan(@Body() dto: Partial<InspectionPlan>, @Request() req) {
    return this.svc.createPlan({ ...dto, projectId: req.headers['x-project-id'] })
  }
  
  @Get('plans') getPlans(@Request() req) { return this.svc.getPlans(req.headers['x-project-id']) }
  
  @Put('plans/:id') updatePlan(@Param('id') id: string, @Body() dto: Partial<InspectionPlan>) {
    return this.svc.updatePlan(id, dto)
  }
  
  @Get('today') getTodayPlans(@Request() req) {
    return this.svc.getTodayPlans(req.user.id, req.headers['x-project-id'])
  }
  
  @Post('records') createRecord(@Body() dto: CreateInspectionRecordPayload, @Request() req) {
    return this.svc.createRecord(dto, req.user.id, req.headers['x-project-id'])
  }
  
  @Get('records') getRecords(
    @Request() req,
    @Query('planId') planId?: string,
    @Query('page') p = 1,
    @Query('pageSize') ps = 20,
  ) {
    return this.svc.getRecords(req.headers['x-project-id'], planId, +p, +ps)
  }
  
  @Get('stats') getStats(@Request() req) { return this.svc.getStats(req.headers['x-project-id']) }
}

@Module({
  imports: [TypeOrmModule.forFeature([InspectionPlan, InspectionRecord]), OrdersModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
