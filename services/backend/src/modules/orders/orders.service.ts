import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { v4 as uuidv4 } from 'uuid'
import { AddRepairLogDto } from './dto/add-repair-log.dto'
import { AssignOrderDto } from './dto/assign-order.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { WorkOrder, OrderPriority, OrderStatus } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'
import { OrderStateMachine } from './order-state.machine'
import { PartsService } from '../parts/parts.service'
import { Device } from '../devices/entities/device.entity'
import { User, UserRole } from '../users/entities/user.entity'

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly orderRepo: Repository<WorkOrder>,
    @InjectRepository(RepairLog)
    private readonly repairLogRepo: Repository<RepairLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stateMachine: OrderStateMachine,
    private readonly dataSource: DataSource,
    private readonly partsService: PartsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateOrderDto, reporterId: string, projectId: string): Promise<WorkOrder> {
    const savedOrder = await this.dataSource.transaction(async manager => {
      const orderNo = await this.generateOrderNo(manager)
      const repo = manager.getRepository(WorkOrder)
      const order = repo.create({
        ...dto,
        id: uuidv4(),
        orderNo,
        projectId,
        reporterId,
        status: OrderStatus.PENDING,
        isOvertime: false,
      })
      return repo.save(order)
    })
    this.eventEmitter.emit('order.updated', { ...savedOrder, eventAction: 'create' })
    return savedOrder
  }

  async findAll(
    projectId: string,
    page = 1,
    pageSize = 20,
    status?: string,
    priority?: OrderPriority,
    assigneeId?: string,
    keyword?: string,
    deviceId?: string,
  ) {
    const normalizedKeyword = keyword?.trim().toLowerCase()
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndMapOne('o.device', Device, 'device', this.columnEqualsColumn('device.id', 'o."deviceId"'))
      .leftJoinAndMapOne('o.reporter', User, 'reporter', this.columnEqualsColumn('reporter.id', 'o."reporterId"'))
      .leftJoinAndMapOne('o.assignee', User, 'assignee', this.columnEqualsColumn('assignee.id', 'o."assigneeId"'))
      .where(this.columnEqualsParam('o."projectId"', 'projectId'), { projectId })
      .orderBy('o.createdAt', 'DESC')

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length > 0) {
        qb.andWhere('o.status IN (:...statuses)', { statuses })
      }
    }
    if (priority) qb.andWhere('o.priority = :priority', { priority })
    if (assigneeId) qb.andWhere(this.columnEqualsParam('o."assigneeId"', 'assigneeId'), { assigneeId })
    if (deviceId) qb.andWhere(this.columnEqualsParam('o."deviceId"', 'deviceId'), { deviceId })
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

  async findOne(id: string, projectId?: string): Promise<WorkOrder> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndMapOne('o.device', Device, 'device', this.columnEqualsColumn('device.id', 'o."deviceId"'))
      .leftJoinAndMapOne('o.reporter', User, 'reporter', this.columnEqualsColumn('reporter.id', 'o."reporterId"'))
      .leftJoinAndMapOne('o.assignee', User, 'assignee', this.columnEqualsColumn('assignee.id', 'o."assigneeId"'))
      .where(this.columnEqualsParam('o.id', 'id'), { id })

    if (projectId) qb.andWhere(this.columnEqualsParam('o."projectId"', 'projectId'), { projectId })

    const order = await qb.getOne()
    if (!order) throw new NotFoundException(`工单 ${id} 不存在`)
    return order
  }

  async assign(id: string, dto: AssignOrderDto, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    const assignee = await this.userRepo.findOne({ where: { id: dto.assigneeId } })
    if (!assignee || !assignee.isActive) {
      throw new BadRequestException('所选维修负责人不存在或账号已停用')
    }
    if (assignee.role !== UserRole.ENGINEER) {
      throw new BadRequestException('只有维修工程师可以接收维修工单')
    }
    if (!assignee.projectIds?.includes(projectId)) {
      throw new BadRequestException('所选维修工程师不属于当前项目')
    }
    return this.stateMachine.assign(order, dto.assigneeId)
  }

  async accept(id: string, userId: string, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有被派单的工程师才能接单')
    }
    return this.stateMachine.accept(order)
  }

  async reject(id: string, userId: string, reason: string, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有被派单的工程师才能拒单')
    }
    return this.stateMachine.reject(order, reason)
  }

  async suspend(id: string, reason: string, userId: string, projectId: string, role: UserRole): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    if (role !== UserRole.ADMIN && order.assigneeId !== userId) {
      throw new ForbiddenException('只有负责人或管理员才能挂起工单')
    }
    return this.stateMachine.suspend(order, reason)
  }

  async resume(id: string, userId: string, projectId: string, role: UserRole): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    if (role !== UserRole.ADMIN && order.assigneeId !== userId) {
      throw new ForbiddenException('只有负责人或管理员才能恢复工单')
    }
    return this.stateMachine.resume(order)
  }

  async submit(id: string, userId: string, repairCost: number | undefined, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    if (order.assigneeId !== userId) {
      throw new ForbiddenException('只有负责该工单的工程师才能提交验收')
    }
    const repairLogCount = await this.repairLogRepo.count({ where: { orderId: id } })
    if (repairLogCount <= 0) {
      throw new BadRequestException('提交验收前必须先添加至少一条维修记录')
    }
    if (repairCost !== undefined) order.repairCost = repairCost
    return this.stateMachine.submit(order)
  }

  async acceptCheck(id: string, note: string | undefined, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    return this.stateMachine.acceptCheck(order, note)
  }

  async rejectCheck(id: string, reason: string, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    return this.stateMachine.rejectCheck(order, reason)
  }

  async cancel(id: string, reason: string, projectId: string): Promise<WorkOrder> {
    const order = await this.findOne(id, projectId)
    return this.stateMachine.cancel(order, reason)
  }

  async remove(id: string, projectId: string): Promise<{ deleted: true }> {
    const order = await this.findOne(id, projectId)
    await this.dataSource.transaction(async manager => {
      await manager
        .createQueryBuilder()
        .delete()
        .from('spare_part_logs')
        .where('"orderId" = :id', { id })
        .execute()
      await manager
        .createQueryBuilder()
        .delete()
        .from(RepairLog)
        .where('"orderId" = :id', { id })
        .execute()
      await manager
        .createQueryBuilder()
        .update('inspection_records')
        .set({ orderId: null })
        .where('"orderId" = :id', { id })
        .execute()
      await manager.delete(WorkOrder, { id, projectId })
    })
    this.eventEmitter.emit('order.updated', { ...order, eventAction: 'delete' })
    return { deleted: true }
  }

  async addRepairLog(
    orderId: string,
    engineerId: string,
    dto: AddRepairLogDto,
    projectId: string,
    role: UserRole,
  ): Promise<RepairLog> {
    return this.dataSource.transaction(async manager => {
      const order = await manager.getRepository(WorkOrder).findOne({ where: { id: orderId, projectId } })
      if (!order) throw new NotFoundException(`工单 ${orderId} 不存在`)
      if (role !== UserRole.ENGINEER || order.assigneeId !== engineerId) {
        throw new ForbiddenException('只有负责该工单的维修工程师才能添加维修记录')
      }
      if (order.status !== OrderStatus.PROCESSING) {
        throw new ForbiddenException('工单不在处理中，无法添加维修记录')
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
          projectId,
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

  async getRepairLogs(orderId: string, projectId: string): Promise<RepairLog[]> {
    await this.findOne(orderId, projectId)
    return this.repairLogRepo
      .createQueryBuilder('log')
      .leftJoinAndMapOne('log.engineer', User, 'engineer', this.columnEqualsColumn('engineer.id', 'log."engineerId"'))
      .where(this.columnEqualsParam('log."orderId"', 'orderId'), { orderId })
      .orderBy('log.loggedAt', 'ASC')
      .getMany()
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
      .where(this.columnEqualsParam('o."projectId"', 'projectId'), { projectId })
      .groupBy('o.status')
      .getRawMany()

    const summary: Record<string, number> = {}
    for (const row of rows) {
      summary[row.status] = Number(row.count)
    }
    return summary
  }

  async findOverdue(projectId: string) {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const now = new Date()
    const activeStatuses = [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.PROCESSING, OrderStatus.SUSPENDED]

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndMapOne('o.device', Device, 'device', this.columnEqualsColumn('device.id', 'o."deviceId"'))
      .leftJoinAndMapOne('o.assignee', User, 'assignee', this.columnEqualsColumn('assignee.id', 'o."assigneeId"'))
      .where(this.columnEqualsParam('o."projectId"', 'projectId'), { projectId })
      .andWhere('o.status IN (:...activeStatuses)', { activeStatuses })
      .andWhere(
        '(o."slaDeadline" < :now OR (o."slaDeadline" IS NULL AND o."createdAt" < :cutoff))',
        { now, cutoff: cutoff48h },
      )
      .orderBy('o.createdAt', 'ASC')

    const items = await qb.getMany()
    return { items, total: items.length }
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

  private columnEqualsColumn(left: string, right: string) {
    if (this.dataSource.options.type === 'postgres') return `CAST(${left} AS text) = CAST(${right} AS text)`
    return `${left} = ${right}`
  }

  private columnEqualsParam(column: string, paramName: string) {
    if (this.dataSource.options.type === 'postgres') return `CAST(${column} AS text) = :${paramName}`
    return `${column} = :${paramName}`
  }
}
