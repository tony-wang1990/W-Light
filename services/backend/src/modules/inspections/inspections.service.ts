import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { OrdersService } from '../orders/orders.service'
import { OrderCategory, OrderPriority } from '../orders/entities/order.entity'
import { InspectionFrequency, InspectionPlan } from './entities/inspection-plan.entity'
import { InspectionRecord, InspectionStatus } from './entities/inspection-record.entity'
import { CreateInspectionPlanDto, UpdateInspectionPlanDto } from './dto/inspection-plan.dto'
import { CreateInspectionRecordDto } from './dto/inspection-record.dto'

type InspectionPlanWriteDto = (CreateInspectionPlanDto | UpdateInspectionPlanDto) & {
  projectId?: string
}

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(InspectionPlan) private planRepo: Repository<InspectionPlan>,
    @InjectRepository(InspectionRecord) private recordRepo: Repository<InspectionRecord>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
  ) {}

  private normalizePlanDto(dto: InspectionPlanWriteDto): Partial<InspectionPlan> {
    const { nextInspectionAt, ...rest } = dto
    return {
      ...rest,
      nextInspectionAt: nextInspectionAt ? new Date(nextInspectionAt) : undefined,
    }
  }

  createPlan(dto: CreateInspectionPlanDto & { projectId: string }) {
    return this.planRepo.save(this.planRepo.create(this.normalizePlanDto(dto)))
  }

  updatePlan(id: string, dto: UpdateInspectionPlanDto, projectId: string) {
    return this.planRepo.update({ id, projectId }, { ...this.normalizePlanDto(dto), projectId })
  }

  deletePlan(id: string) { return this.planRepo.delete(id) }

  getPlans(projectId: string) {
    return this.planRepo
      .createQueryBuilder('p')
      .where(this.columnEqualsParam('p."projectId"', 'projectId'), { projectId })
      .andWhere('p."isActive" = :isActive', { isActive: 1 })
      .getMany()
  }

  private getNextInspectionAt(current: Date, frequency: string) {
    const next = new Date(current)
    if (frequency === InspectionFrequency.WEEKLY) next.setDate(next.getDate() + 7)
    else if (frequency === InspectionFrequency.MONTHLY) next.setMonth(next.getMonth() + 1)
    else next.setDate(next.getDate() + 1)
    return next
  }

  async createRecord(dto: CreateInspectionRecordDto, inspectorId: string, projectId: string) {
    const { createOrder, ...recordDto } = dto
    const plan = dto.planId ? await this.planRepo.findOne({ where: { id: dto.planId, projectId } }) : null
    if (dto.planId && !plan) throw new NotFoundException('巡检计划不存在')
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
      .innerJoin(
        InspectionPlan,
        'p',
        `${this.columnEqualsColumn('p.id', 'r."planId"')} AND ${this.columnEqualsParam('p."projectId"', 'projectId')}`,
        { projectId },
      )
      .orderBy('r."inspectedAt"', 'DESC')

    if (planId) qb.andWhere(this.columnEqualsParam('r."planId"', 'planId'), { planId })

    const [items, total] = await qb
      .skip((page - 1) * ps)
      .take(ps)
      .getManyAndCount()

    return { items, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
  }

  getTodayPlans(assigneeId: string, projectId: string) {
    return this.planRepo
      .createQueryBuilder('p')
      .where(this.columnEqualsParam('p."projectId"', 'projectId'), { projectId })
      .andWhere('p."isActive" = :isActive', { isActive: 1 })
      .andWhere(`(${this.columnEqualsParam('p."assigneeId"', 'assigneeId')} OR p."assigneeId" IS NULL)`, { assigneeId })
      .andWhere('(p."nextInspectionAt" IS NULL OR p."nextInspectionAt" <= :now)', { now: new Date() })
      .orderBy('p."nextInspectionAt"', 'ASC')
      .getMany()
  }

  async getStats(projectId: string) {
    const planScope = this.planRepo
      .createQueryBuilder('p')
      .where(this.columnEqualsParam('p."projectId"', 'projectId'), { projectId })
      .andWhere('p."isActive" = :isActive', { isActive: 1 })
    const total = await planScope.getCount()
    const plans = await planScope.select('p.id', 'id').getRawMany<{ id: string }>()
    const planIds = plans.map(plan => plan.id)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const todayRecords = planIds.length === 0
      ? 0
      : await this.recordRepo
        .createQueryBuilder('r')
        .where(this.columnInParams('r."planId"', 'planIds'), { planIds })
        .andWhere('r."inspectedAt" >= :start', { start })
        .andWhere('r."inspectedAt" < :end', { end })
        .getCount()
    return { totalPlans: total, todayRecords }
  }

  private columnEqualsColumn(left: string, right: string) {
    if (this.dataSource.options.type === 'postgres') return `CAST(${left} AS text) = CAST(${right} AS text)`
    return `${left} = ${right}`
  }

  private columnEqualsParam(column: string, paramName: string) {
    if (this.dataSource.options.type === 'postgres') return `CAST(${column} AS text) = :${paramName}`
    return `${column} = :${paramName}`
  }

  private columnInParams(column: string, paramName: string) {
    if (this.dataSource.options.type === 'postgres') return `CAST(${column} AS text) IN (:...${paramName})`
    return `${column} IN (:...${paramName})`
  }
}
