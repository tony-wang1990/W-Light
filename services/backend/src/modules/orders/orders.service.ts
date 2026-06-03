import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, EntityManager } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { WorkOrder, OrderStatus, OrderPriority } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'
import { OrderStateMachine } from './order-state.machine'
import { CreateOrderDto } from './dto/create-order.dto'
import { AssignOrderDto } from './dto/assign-order.dto'
import { AddRepairLogDto } from './dto/add-repair-log.dto'
import { PartsService } from '../parts/parts.service'

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly orderRepo: Repository<WorkOrder>,
    @InjectRepository(RepairLog)
    private readonly repairLogRepo: Repository<RepairLog>,
    private readonly stateMachine: OrderStateMachine,
    private readonly dataSource: DataSource,
    private readonly partsService: PartsService,
  ) {}

  async create(dto: CreateOrderDto, reporterId: string, projectId: string): Promise<WorkOrder> {
    return this.dataSource.transaction(async manager => {
      const orderNo = await this.generateOrderNo(manager)
      const repo = manager.getRepository(WorkOrder)
      const order = repo.create({
        id: uuidv4(),
        orderNo,
        projectId,
        reporterId,
        ...dto,
        status: OrderStatus.PENDING,
        isOvertime: false,
      })
      return repo.save(order)
    })
  }

  async findAll(
    projectId: string,
    page = 1,
    pageSize = 20,
    status?: OrderStatus,
    priority?: OrderPriority,
    assigneeId?: string,
    keyword?: string,
    deviceId?: string,
  ) {
    const normalizedKeyword = keyword?.trim().toLowerCase()
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.device', 'device')
      .leftJoinAndSelect('o.reporter', 'reporter')
      .leftJoinAndSelect('o.assignee', 'assignee')
      .where('o."projectId" = :projectId', { projectId })
      .orderBy('o."createdAt"', 'DESC')

    if (status) qb.andWhere('o.status = :status', { status })
    if (priority) qb.andWhere('o.priority = :priority', { priority })
    if (assigneeId) qb.andWhere('o."assigneeId" = :assigneeId', { assigneeId })
    if (deviceId) qb.andWhere('o."deviceId" = :deviceId', { deviceId })
    if (normalizedKeyword) {
      qb.andWhere(
        `(
          LOWER(o."orderNo") LIKE :kw OR
          LOWER(o."faultDesc") LIKE :kw OR
          LOWER(COALESCE(device.name, '')) LIKE :kw
        )`,
        { kw: `%${normalizedKeyword}%` },
      )
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async findOne(id: string): Promise<WorkOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['device', 'reporter', 'assignee', 'project'],
    })
    if (!order) throw new NotFoundException(`工单 ${id} 不存在`)
    return order
  }

  async assign(id: string, dto: AssignOrderDto): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.assign(order, dto.assigneeId)
  }

  async accept(id: string, userId: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有被派单的工程师才能接单')
    }
    return this.stateMachine.accept(order)
  }

  async reject(id: string, userId: string, reason: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有被派单的工程师才能拒单')
    }
    return this.stateMachine.reject(order, reason)
  }

  async suspend(id: string, reason: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.suspend(order, reason)
  }

  async resume(id: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.resume(order)
  }

  async submit(id: string, userId: string, repairCost?: number): Promise<WorkOrder> {
    const order = await this.findOne(id)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有负责该工单的工程师才能提交验收')
    }
    if (repairCost !== undefined) order.repairCost = repairCost
    return this.stateMachine.submit(order)
  }

  async acceptCheck(id: string, note?: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.acceptCheck(order, note)
  }

  async rejectCheck(id: string, reason: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.rejectCheck(order, reason)
  }

  async cancel(id: string, reason: string): Promise<WorkOrder> {
    const order = await this.findOne(id)
    return this.stateMachine.cancel(order, reason)
  }

  async addRepairLog(orderId: string, engineerId: string, dto: AddRepairLogDto): Promise<RepairLog> {
    return this.dataSource.transaction(async manager => {
      const order = await manager.getRepository(WorkOrder).findOne({ where: { id: orderId } })
      if (!order) throw new NotFoundException(`工单 ${orderId} 不存在`)
      if (![OrderStatus.PROCESSING, OrderStatus.REVIEWING].includes(order.status)) {
        throw new ForbiddenException('工单不在处理中或待验收状态，无法添加维修记录')
      }

      const partUsages = []
      for (const usage of dto.partUsages || []) {
        if (!usage.partId || !usage.quantity || Number(usage.quantity) <= 0) continue

        const result = await this.partsService.outbound(
          usage.partId,
          Number(usage.quantity),
          engineerId,
          orderId,
          usage.note || `工单 ${order.orderNo} 维修消耗`,
          manager,
        )

        partUsages.push({
          partId: usage.partId,
          name: result.part.name,
          quantity: Number(usage.quantity),
          unit: result.part.unit,
          note: usage.note,
        })
      }

      const repo = manager.getRepository(RepairLog)
      const log = repo.create({
        ...dto,
        partUsages,
        orderId,
        engineerId,
      })
      return repo.save(log)
    })
  }

  async getRepairLogs(orderId: string): Promise<RepairLog[]> {
    return this.repairLogRepo.find({
      where: { orderId },
      relations: ['engineer'],
      order: { loggedAt: 'ASC' },
    })
  }

  async markOvertimeOrders(): Promise<number> {
    const now = new Date()
    const result = await this.orderRepo
      .createQueryBuilder()
      .update(WorkOrder)
      .set({ isOvertime: true })
      .where('"slaDeadline" < :now', { now })
      .andWhere('"isOvertime" = false')
      .andWhere('status NOT IN (:...closedStatuses)', {
        closedStatuses: [OrderStatus.CLOSED, OrderStatus.REJECTED],
      })
      .execute()
    return result.affected || 0
  }

  async getStatusSummary(projectId: string) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(o.id)', 'count')
      .where('o."projectId" = :projectId', { projectId })
      .groupBy('o.status')
      .getRawMany()

    const summary: Record<string, number> = {}
    for (const row of rows) {
      summary[row.status] = Number(row.count)
    }
    return summary
  }

  private async generateOrderNo(manager: EntityManager): Promise<string> {
    const dateKey = this.formatOrderDateKey()
    const seq = await this.nextOrderSequence(manager, dateKey)
    return `WO-${dateKey}-${String(seq).padStart(4, '0')}`
  }

  private formatOrderDateKey(date = new Date()): string {
    const timeZone = process.env.ORDER_NO_TIME_ZONE || 'Asia/Shanghai'
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date).replace(/-/g, '')
  }

  private async nextOrderSequence(manager: EntityManager, dateKey: string): Promise<number> {
    const prefix = `WO-${dateKey}-%`

    if (this.dataSource.options.type === 'postgres') {
      const [row] = await manager.query(`
        INSERT INTO work_order_sequences ("dateKey", value)
        SELECT $1, COALESCE(MAX(CAST(SUBSTRING("orderNo" FROM 13) AS integer)), 0) + 1
        FROM work_orders
        WHERE "orderNo" LIKE $2
        ON CONFLICT ("dateKey") DO UPDATE
          SET value = work_order_sequences.value + 1,
              "updatedAt" = CURRENT_TIMESTAMP
        RETURNING value
      `, [dateKey, prefix])
      return Number(row.value)
    }

    const [row] = await manager.query(`
      INSERT INTO work_order_sequences ("dateKey", value)
      SELECT ?, COALESCE(MAX(CAST(substr("orderNo", 13) AS integer)), 0) + 1
      FROM work_orders
      WHERE "orderNo" LIKE ?
      ON CONFLICT("dateKey") DO UPDATE
        SET value = value + 1,
            "updatedAt" = CURRENT_TIMESTAMP
      RETURNING value
    `, [dateKey, prefix])
    return Number(row.value)
  }
}
