import { EventEmitter2 } from '@nestjs/event-emitter'
import { Repository } from 'typeorm'
import { OrderStateMachine } from './order-state.machine'
import { OrderPriority, OrderStatus, WorkOrder } from './entities/order.entity'

describe('OrderStateMachine reassignment', () => {
  it('allows an assigned order to be reassigned before it is accepted', async () => {
    const original = {
      id: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      orderNo: 'WO-20260603-0002',
      status: OrderStatus.ASSIGNED,
      priority: OrderPriority.P0,
      assigneeId: '33333333-3333-4333-8333-333333333333',
    } as WorkOrder
    const updated = {
      ...original,
      assigneeId: '44444444-4444-4444-8444-444444444444',
    } as WorkOrder
    const repo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn().mockResolvedValue(updated),
    } as unknown as Repository<WorkOrder>
    const events = { emit: jest.fn() } as unknown as EventEmitter2
    const machine = new OrderStateMachine(repo, events)

    const result = await machine.assign(original, updated.assigneeId!)

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: original.id,
        projectId: original.projectId,
      }),
      expect.objectContaining({
        status: OrderStatus.ASSIGNED,
        assigneeId: updated.assigneeId,
      }),
    )
    expect(result.assigneeId).toBe(updated.assigneeId)
    expect(events.emit).toHaveBeenCalledWith('order.updated', expect.objectContaining({
      id: original.id,
      eventAction: 'assign',
    }))
  })

  it('clears assignment SLA when an engineer rejects the order', async () => {
    const original = {
      id: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      orderNo: 'WO-20260603-0003',
      status: OrderStatus.ASSIGNED,
      priority: OrderPriority.P1,
      assigneeId: '33333333-3333-4333-8333-333333333333',
      slaDeadline: new Date(),
    } as WorkOrder
    const repo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn().mockResolvedValue({ ...original, status: OrderStatus.PENDING }),
    } as unknown as Repository<WorkOrder>
    const events = { emit: jest.fn() } as unknown as EventEmitter2
    const machine = new OrderStateMachine(repo, events)

    await machine.reject(original, 'Not available')

    expect(repo.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: OrderStatus.PENDING,
        assigneeId: null,
        assignedAt: null,
        slaDeadline: null,
      }),
    )
  })

  it('clears the suspend reason when work resumes', async () => {
    const original = {
      id: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      orderNo: 'WO-20260603-0004',
      status: OrderStatus.SUSPENDED,
      priority: OrderPriority.P2,
      rejectReason: 'Waiting for spare parts',
    } as WorkOrder
    const repo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn().mockResolvedValue({ ...original, status: OrderStatus.PROCESSING }),
    } as unknown as Repository<WorkOrder>
    const events = { emit: jest.fn() } as unknown as EventEmitter2
    const machine = new OrderStateMachine(repo, events)

    await machine.resume(original)

    expect(repo.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: OrderStatus.PROCESSING,
        rejectReason: null,
      }),
    )
  })
})
