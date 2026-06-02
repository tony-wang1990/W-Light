import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrdersService } from '../orders/orders.service'
import { OrderCategory, OrderPriority } from '../orders/entities/order.entity'
import { InspectionFrequency, InspectionPlan } from './entities/inspection-plan.entity'
import { InspectionRecord, InspectionStatus } from './entities/inspection-record.entity'

export interface CreateInspectionRecordPayload extends Partial<InspectionRecord> {
  createOrder?: boolean
}

@Injectable()
export class InspectionsService {
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
      .innerJoin(InspectionPlan, 'p', 'p.id = r."planId" AND p."projectId" = :projectId', { projectId })
      .orderBy('r."inspectedAt"', 'DESC')

    if (planId) qb.andWhere('r."planId" = :planId', { planId })

    const [items, total] = await qb
      .skip((page - 1) * ps)
      .take(ps)
      .getManyAndCount()

    return { items, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
  }

  getTodayPlans(assigneeId: string, projectId: string) {
    return this.planRepo
      .createQueryBuilder('p')
      .where('p."projectId" = :projectId', { projectId })
      .andWhere('p."isActive" = :isActive', { isActive: 1 })
      .andWhere('(p."assigneeId" = :assigneeId OR p."assigneeId" IS NULL)', { assigneeId })
      .andWhere('(p."nextInspectionAt" IS NULL OR p."nextInspectionAt" <= :now)', { now: new Date() })
      .orderBy('p."nextInspectionAt"', 'ASC')
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
        .where('r."planId" IN (:...planIds)', { planIds })
        .andWhere('r."inspectedAt" >= :start', { start })
        .andWhere('r."inspectedAt" < :end', { end })
        .getCount()
    return { totalPlans: total, todayRecords }
  }
}
