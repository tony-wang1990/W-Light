import { BadRequestException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { OrderPriority, OrderStatus, WorkOrder } from './entities/order.entity'

export const SLA_COMPLETE_HOURS: Record<OrderPriority, number> = {
  [OrderPriority.P0]: 2,
  [OrderPriority.P1]: 8,
  [OrderPriority.P2]: 24,
  [OrderPriority.P3]: 168,
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待派单',
  [OrderStatus.ASSIGNED]: '已派单',
  [OrderStatus.PROCESSING]: '处理中',
  [OrderStatus.SUSPENDED]: '已挂起',
  [OrderStatus.REVIEWING]: '待验收',
  [OrderStatus.CLOSED]: '已关闭',
  [OrderStatus.REJECTED]: '已取消',
}

const ACTION_LABELS: Record<string, string> = {
  assign: '派单或改派',
  accept: '接单',
  reject: '拒单',
  suspend: '挂起',
  resume: '恢复',
  submit: '提交验收',
  'accept check': '验收通过',
  'reject check': '验收退回',
  cancel: '取消',
}

type OrderPatch = Partial<Pick<
  WorkOrder,
  | 'status'
  | 'assigneeId'
  | 'assignedAt'
  | 'startedAt'
  | 'submittedAt'
  | 'closedAt'
  | 'slaDeadline'
  | 'isOvertime'
  | 'repairCost'
  | 'rejectReason'
  | 'acceptanceNote'
>>

export class OrderStateMachine {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly orderRepo: Repository<WorkOrder>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private assertStatus(order: WorkOrder, expectedStatuses: OrderStatus[], action: string) {
    if (!expectedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `工单 ${order.orderNo} 当前状态为“${STATUS_LABELS[order.status] || order.status}”，不能执行“${ACTION_LABELS[action] || action}”操作`,
      )
    }
  }

  private async transition(
    order: WorkOrder,
    expectedStatuses: OrderStatus[],
    action: string,
    patch: OrderPatch,
  ) {
    this.assertStatus(order, expectedStatuses, action)

    const result = await this.orderRepo.update({
      id: order.id,
      projectId: order.projectId,
      status: In(expectedStatuses),
    }, patch)

    if (!result.affected) {
      throw new ConflictException(`工单 ${order.orderNo} 已被其他人员修改，请刷新后重试`)
    }

    const updatedOrder = await this.orderRepo.findOneOrFail({
      where: { id: order.id, projectId: order.projectId },
      relations: ['device', 'reporter', 'assignee', 'project'],
    })

    this.eventEmitter.emit('order.updated', { ...updatedOrder, eventAction: action })

    return updatedOrder
  }

  async assign(order: WorkOrder, assigneeId: string): Promise<WorkOrder> {
    const slaHours = SLA_COMPLETE_HOURS[order.priority]
    return this.transition(order, [OrderStatus.PENDING, OrderStatus.ASSIGNED], 'assign', {
      status: OrderStatus.ASSIGNED,
      assigneeId,
      assignedAt: new Date(),
      slaDeadline: new Date(Date.now() + slaHours * 60 * 60 * 1000),
      rejectReason: null,
    })
  }

  async accept(order: WorkOrder): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.ASSIGNED], 'accept', {
      status: OrderStatus.PROCESSING,
      startedAt: new Date(),
    })
  }

  async reject(order: WorkOrder, reason: string): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.ASSIGNED], 'reject', {
      status: OrderStatus.PENDING,
      assigneeId: null,
      assignedAt: null,
      slaDeadline: null,
      rejectReason: reason,
    })
  }

  async suspend(order: WorkOrder, reason: string): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.PROCESSING], 'suspend', {
      status: OrderStatus.SUSPENDED,
      rejectReason: reason,
    })
  }

  async resume(order: WorkOrder): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.SUSPENDED], 'resume', {
      status: OrderStatus.PROCESSING,
      rejectReason: null,
    })
  }

  async submit(order: WorkOrder): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.PROCESSING], 'submit', {
      status: OrderStatus.REVIEWING,
      submittedAt: new Date(),
      repairCost: order.repairCost,
    })
  }

  async acceptCheck(order: WorkOrder, note?: string): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.REVIEWING], 'accept check', {
      status: OrderStatus.CLOSED,
      closedAt: new Date(),
      acceptanceNote: note,
      isOvertime: Boolean(order.slaDeadline && new Date() > order.slaDeadline),
    })
  }

  async rejectCheck(order: WorkOrder, reason: string): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.REVIEWING], 'reject check', {
      status: OrderStatus.PROCESSING,
      rejectReason: reason,
      submittedAt: null,
    })
  }

  async cancel(order: WorkOrder, reason: string): Promise<WorkOrder> {
    return this.transition(order, [OrderStatus.PENDING, OrderStatus.ASSIGNED], 'cancel', {
      status: OrderStatus.REJECTED,
      rejectReason: reason,
      closedAt: new Date(),
    })
  }
}
