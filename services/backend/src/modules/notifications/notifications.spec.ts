import { EventEmitter2 } from '@nestjs/event-emitter'
import { ForbiddenException } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { OrderNotificationsListener, NotificationsService } from './notifications.module'
import { SseController } from './sse.controller'
import { OrderStatus, WorkOrder } from '../orders/entities/order.entity'
import { UserRole } from '../users/entities/user.entity'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const ORDER_ID = '22222222-2222-4222-8222-222222222222'
const REPORTER_ID = '33333333-3333-4333-8333-333333333333'
const ASSIGNEE_ID = '44444444-4444-4444-8444-444444444444'

describe('order notifications and SSE', () => {
  it('creates a station notification for the engineer when an order is assigned', async () => {
    const notifications = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationsService
    const listener = new OrderNotificationsListener(notifications)

    await listener.handleOrderUpdated({
      id: ORDER_ID,
      orderNo: 'WO-20260620-0001',
      projectId: PROJECT_ID,
      reporterId: REPORTER_ID,
      assigneeId: ASSIGNEE_ID,
      status: OrderStatus.ASSIGNED,
      eventAction: 'assign',
    } as WorkOrder & { eventAction: string })

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: ASSIGNEE_ID,
      type: 'order',
      title: '收到新工单',
      refId: ORDER_ID,
      refType: 'order',
      isRead: false,
    }))
  })

  it('emits named order_updated SSE events only for the selected project', async () => {
    const events = new EventEmitter2()
    const controller = new SseController(events)
    const stream = controller.ordersStream({
      user: { role: UserRole.ADMIN, projectIds: [] },
    }, PROJECT_ID)
    const nextEvent = firstValueFrom(stream)

    events.emit('order.updated', { id: 'other', projectId: '55555555-5555-4555-8555-555555555555' })
    events.emit('order.updated', { id: ORDER_ID, projectId: PROJECT_ID, eventAction: 'assign' })

    await expect(nextEvent).resolves.toMatchObject({
      type: 'order_updated',
      data: { id: ORDER_ID, projectId: PROJECT_ID, eventAction: 'assign' },
    })
  })

  it('rejects SSE subscriptions to projects outside the user access list', () => {
    const controller = new SseController(new EventEmitter2())

    expect(() => controller.ordersStream({
      user: { role: UserRole.ENGINEER, projectIds: [] },
    }, PROJECT_ID)).toThrow(ForbiddenException)
  })
})
