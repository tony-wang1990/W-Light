/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use lightweight TypeORM repository mocks. */

import { ForbiddenException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { PartsService } from '../parts/parts.service'
import { UserRole } from '../users/entities/user.entity'
import { OrderPriority, OrderStatus, WorkOrder } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'
import { OrderStateMachine } from './order-state.machine'
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
  let stateMachine: jest.Mocked<OrderStateMachine>
  let dataSource: jest.Mocked<DataSource>
  let partsService: jest.Mocked<PartsService>
  let service: OrdersService

  beforeEach(() => {
    orderRepo = {
      createQueryBuilder: jest.fn(),
    }
    repairLogRepo = {}
    stateMachine = {} as jest.Mocked<OrderStateMachine>
    dataSource = {
      options: { type: 'postgres' },
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>
    partsService = {
      outbound: jest.fn(),
    } as unknown as jest.Mocked<PartsService>

    service = new OrdersService(orderRepo, repairLogRepo, stateMachine, dataSource, partsService)
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
})
