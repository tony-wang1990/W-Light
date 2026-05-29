import { BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkOrder, OrderStatus, OrderPriority } from './entities/order.entity'

/** SLA 完成时限（小时）*/
export const SLA_COMPLETE_HOURS: Record<OrderPriority, number> = {
  [OrderPriority.P0]: 2,
  [OrderPriority.P1]: 8,
  [OrderPriority.P2]: 24,
  [OrderPriority.P3]: 168,
}

/**
 * 工单状态机
 * 封装所有状态转换的合法性验证和时间戳更新
 */
export class OrderStateMachine {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly orderRepo: Repository<WorkOrder>,
  ) {}

  /** 验证状态转换是否合法 */
  private assertStatus(order: WorkOrder, expectedStatuses: OrderStatus[], action: string) {
    if (!expectedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `工单 ${order.orderNo} 当前状态为【${order.status}】，无法执行【${action}】操作`,
      )
    }
  }

  /** 派单：pending → assigned */
  async assign(order: WorkOrder, assigneeId: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.PENDING], '派单')
    order.status = OrderStatus.ASSIGNED
    order.assigneeId = assigneeId
    order.assignedAt = new Date()
    // 计算 SLA 截止时间
    const slaHours = SLA_COMPLETE_HOURS[order.priority]
    order.slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)
    return this.orderRepo.save(order)
  }

  /** 接单：assigned → processing */
  async accept(order: WorkOrder): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.ASSIGNED], '接单')
    order.status = OrderStatus.PROCESSING
    order.startedAt = new Date()
    return this.orderRepo.save(order)
  }

  /** 拒单：assigned → pending */
  async reject(order: WorkOrder, reason: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.ASSIGNED], '拒单')
    order.status = OrderStatus.PENDING
    order.assigneeId = null
    order.assignedAt = null
    order.rejectReason = reason
    return this.orderRepo.save(order)
  }

  /** 挂起：processing → suspended */
  async suspend(order: WorkOrder, reason: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.PROCESSING], '挂起')
    order.status = OrderStatus.SUSPENDED
    order.rejectReason = reason // 复用字段存挂起原因
    return this.orderRepo.save(order)
  }

  /** 恢复：suspended → processing */
  async resume(order: WorkOrder): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.SUSPENDED], '恢复')
    order.status = OrderStatus.PROCESSING
    return this.orderRepo.save(order)
  }

  /** 提交验收：processing → reviewing */
  async submit(order: WorkOrder): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.PROCESSING], '提交验收')
    order.status = OrderStatus.REVIEWING
    order.submittedAt = new Date()
    return this.orderRepo.save(order)
  }

  /** 验收通过：reviewing → closed */
  async acceptCheck(order: WorkOrder, note?: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.REVIEWING], '验收通过')
    order.status = OrderStatus.CLOSED
    order.closedAt = new Date()
    order.acceptanceNote = note
    // 检查是否超时
    if (order.slaDeadline && new Date() > order.slaDeadline) {
      order.isOvertime = true
    }
    return this.orderRepo.save(order)
  }

  /** 验收退回：reviewing → processing */
  async rejectCheck(order: WorkOrder, reason: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.REVIEWING], '验收退回')
    order.status = OrderStatus.PROCESSING
    order.rejectReason = reason
    order.submittedAt = null
    return this.orderRepo.save(order)
  }

  /** 取消工单（管理员）：pending → rejected */
  async cancel(order: WorkOrder, reason: string): Promise<WorkOrder> {
    this.assertStatus(order, [OrderStatus.PENDING, OrderStatus.ASSIGNED], '取消工单')
    order.status = OrderStatus.REJECTED
    order.rejectReason = reason
    order.closedAt = new Date()
    return this.orderRepo.save(order)
  }
}
