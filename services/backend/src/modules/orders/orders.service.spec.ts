/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use lightweight TypeORM repository mocks. */

import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { PartsService } from '../parts/parts.service'
import { UserRole } from '../users/entities/user.entity'
import { OrderPriority, OrderStatus, WorkOrder } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'
import { OrderStateMachine } from './order-state.machine'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { OrdersService } from './orders.service'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const ENGINEER_ID = '22222222-2222-4222-8222-222222222222'
const ORDER_ID = '33333333-3333-4333-8333-333333333333'
const PART_ID = '44444444-4444-4444-8444-444444444444'

function createPagedQueryBuilder() {
  const qb: any = {
    leftJoinAndMapOne: jest.fn(() => qb),
    where: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }
  return qb
}

describe('OrdersService', () => {
  let orderRepo: any
  let repairLogRepo: any
  let userRepo: any
  let stateMachine: jest.Mocked<OrderStateMachine>
  let dataSource: jest.Mocked<DataSource>
  let partsService: jest.Mocked<PartsService>
  let eventEmitter: jest.Mocked<EventEmitter2>
  let service: OrdersService

  beforeEach(() => {
    orderRepo = {
      createQueryBuilder: jest.fn(),
    }
    repairLogRepo = {
      count: jest.fn(),
    }
    userRepo = {
      findOne: jest.fn(),
    }
    stateMachine = {} as jest.Mocked<OrderStateMachine>
    dataSource = {
      options: { type: 'postgres' },
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>
    partsService = {
      outbound: jest.fn(),
    } as any

    eventEmitter = {
      emit: jest.fn(),
    } as any

    service = new OrdersService(orderRepo, repairLogRepo, userRepo, stateMachine, dataSource, partsService, eventEmitter)
  })

  it('uses entity property paths for paged ordering to avoid TypeORM databaseName errors', async () => {
    const qb = createPagedQueryBuilder()
    orderRepo.createQueryBuilder.mockReturnValue(qb)

    await service.findAll(PROJECT_ID, 2, 10, OrderStatus.PENDING, OrderPriority.P1, ENGINEER_ID, 'DMX', undefined)

    expect(qb.orderBy).toHaveBeenCalledWith('o.createdAt', 'DESC')
    expect(qb.skip).toHaveBeenCalledWith(10)
    expect(qb.take).toHaveBeenCalledWith(10)
    expect(qb.where.mock.calls[0][0]).toContain('CAST(o."projectId" AS text) = :projectId')
    expect(qb.andWhere).toHaveBeenCalledWith('CAST(o."assigneeId" AS text) = :assigneeId', { assigneeId: ENGINEER_ID })
  })

  it('deducts used parts and saves the repair log in the same transaction', async () => {
    const order = {
      id: ORDER_ID,
      orderNo: 'WO-20260607-0001',
      projectId: PROJECT_ID,
      assigneeId: ENGINEER_ID,
      status: OrderStatus.PROCESSING,
    } as WorkOrder
    const txOrderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
    }
    const txRepairLogRepo = {
      create: jest.fn((value) => ({ id: 'repair-log-id', ...value })),
      save: jest.fn(async (value) => value),
    }
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === WorkOrder) return txOrderRepo
        if (entity === RepairLog) return txRepairLogRepo
        throw new Error(`Unexpected repository ${entity}`)
      }),
    }
    dataSource.transaction.mockImplementation(async (callback: any) => callback(manager))
    partsService.outbound.mockResolvedValue({
      part: { id: PART_ID, name: 'Power Module', unit: 'pcs', stock: 8, minStock: 2 } as any,
      stockAlert: false,
    })

    const result = await service.addRepairLog(
      ORDER_ID,
      ENGINEER_ID,
      {
        stepType: 'replace',
        stepDesc: 'Replace failed power module',
        partUsages: [{ partId: PART_ID, quantity: 2, note: 'burned module' }],
      },
      PROJECT_ID,
      UserRole.ENGINEER,
    )

    expect(dataSource.transaction).toHaveBeenCalledTimes(1)
    expect(partsService.outbound).toHaveBeenCalledWith(
      PART_ID,
      2,
      ENGINEER_ID,
      ORDER_ID,
      'burned module',
      manager,
      PROJECT_ID,
    )
    expect(txRepairLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      orderId: ORDER_ID,
      engineerId: ENGINEER_ID,
      partUsages: [
        {
          partId: PART_ID,
          name: 'Power Module',
          quantity: 2,
          unit: 'pcs',
          note: 'burned module',
        },
      ],
    }))
    expect(result).toMatchObject({ id: 'repair-log-id', orderId: ORDER_ID })
  })

  it('does not save a repair log when part outbound fails inside the transaction', async () => {
    const order = {
      id: ORDER_ID,
      orderNo: 'WO-20260607-0001',
      projectId: PROJECT_ID,
      assigneeId: ENGINEER_ID,
      status: OrderStatus.PROCESSING,
    } as WorkOrder
    const txOrderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
    }
    const txRepairLogRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    }
    const manager = {
      getRepository: jest.fn((entity) => entity === WorkOrder ? txOrderRepo : txRepairLogRepo),
    }
    dataSource.transaction.mockImplementation(async (callback: any) => callback(manager))
    partsService.outbound.mockRejectedValue(new Error('insufficient stock'))

    await expect(service.addRepairLog(
      ORDER_ID,
      ENGINEER_ID,
      {
        stepType: 'replace',
        stepDesc: 'Replace failed power module',
        partUsages: [{ partId: PART_ID, quantity: 2 }],
      },
      PROJECT_ID,
      UserRole.ENGINEER,
    )).rejects.toThrow('insufficient stock')

    expect(txRepairLogRepo.save).not.toHaveBeenCalled()
  })

  it('prevents non-assigned engineers from adding repair logs', async () => {
    const order = {
      id: ORDER_ID,
      orderNo: 'WO-20260607-0001',
      projectId: PROJECT_ID,
      assigneeId: '55555555-5555-4555-8555-555555555555',
      status: OrderStatus.PROCESSING,
    } as WorkOrder
    const manager = {
      getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(order) })),
    }
    dataSource.transaction.mockImplementation(async (callback: any) => callback(manager))

    await expect(service.addRepairLog(
      ORDER_ID,
      ENGINEER_ID,
      { stepType: 'check', stepDesc: 'Checked fixture' },
      PROJECT_ID,
      UserRole.ENGINEER,
    )).rejects.toThrow(ForbiddenException)
  })

  it('allows assigning an active engineer in the current project', async () => {
    const order = { id: ORDER_ID, projectId: PROJECT_ID, status: OrderStatus.PENDING } as WorkOrder
    jest.spyOn(service, 'findOne').mockResolvedValue(order)
    userRepo.findOne.mockResolvedValue({
      id: ENGINEER_ID,
      role: UserRole.ENGINEER,
      isActive: true,
      projectIds: [PROJECT_ID],
    })
    stateMachine.assign = jest.fn().mockResolvedValue({
      ...order,
      assigneeId: ENGINEER_ID,
      status: OrderStatus.ASSIGNED,
    })

    const result = await service.assign(ORDER_ID, { assigneeId: ENGINEER_ID }, PROJECT_ID)

    expect(stateMachine.assign).toHaveBeenCalledWith(order, ENGINEER_ID)
    expect(result.assigneeId).toBe(ENGINEER_ID)
  })

  it.each([
    [{ id: ENGINEER_ID, role: UserRole.ADMIN, isActive: true, projectIds: [PROJECT_ID] }, '只有维修工程师'],
    [{ id: ENGINEER_ID, role: UserRole.INSPECTOR, isActive: true, projectIds: [PROJECT_ID] }, '只有维修工程师'],
    [{ id: ENGINEER_ID, role: UserRole.ENGINEER, isActive: false, projectIds: [PROJECT_ID] }, '不存在或账号已停用'],
    [{ id: ENGINEER_ID, role: UserRole.ENGINEER, isActive: true, projectIds: [] }, '不属于当前项目'],
  ])('rejects an invalid assignee before changing order state', async (assignee, message) => {
    const order = { id: ORDER_ID, projectId: PROJECT_ID, status: OrderStatus.PENDING } as WorkOrder
    jest.spyOn(service, 'findOne').mockResolvedValue(order)
    userRepo.findOne.mockResolvedValue(assignee)
    stateMachine.assign = jest.fn()

    await expect(service.assign(ORDER_ID, { assigneeId: ENGINEER_ID }, PROJECT_ID))
      .rejects.toThrow(message)
    expect(stateMachine.assign).not.toHaveBeenCalled()
  })

  it('requires at least one repair log before submitting for acceptance', async () => {
    const order = {
      id: ORDER_ID,
      projectId: PROJECT_ID,
      assigneeId: ENGINEER_ID,
      status: OrderStatus.PROCESSING,
    } as WorkOrder
    jest.spyOn(service, 'findOne').mockResolvedValue(order)
    repairLogRepo.count.mockResolvedValue(0)
    stateMachine.submit = jest.fn()

    await expect(service.submit(ORDER_ID, ENGINEER_ID, undefined, PROJECT_ID))
      .rejects.toThrow(BadRequestException)
    expect(stateMachine.submit).not.toHaveBeenCalled()
  })

  it('allows the assigned engineer to submit after recording repair work', async () => {
    const order = {
      id: ORDER_ID,
      projectId: PROJECT_ID,
      assigneeId: ENGINEER_ID,
      status: OrderStatus.PROCESSING,
    } as WorkOrder
    const submitted = { ...order, status: OrderStatus.REVIEWING } as WorkOrder
    jest.spyOn(service, 'findOne').mockResolvedValue(order)
    repairLogRepo.count.mockResolvedValue(1)
    stateMachine.submit = jest.fn().mockResolvedValue(submitted)

    await expect(service.submit(ORDER_ID, ENGINEER_ID, 120, PROJECT_ID)).resolves.toBe(submitted)
    expect(order.repairCost).toBe(120)
    expect(stateMachine.submit).toHaveBeenCalledWith(order)
  })
})
