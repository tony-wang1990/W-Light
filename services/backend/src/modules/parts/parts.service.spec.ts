/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use lightweight TypeORM repository mocks. */

import { BadRequestException } from '@nestjs/common'
import { EntityManager } from 'typeorm'
import { SparePart } from './entities/spare-part.entity'
import { SparePartLog, StockOpType } from './entities/spare-part-log.entity'
import { PartsService } from './parts.service'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PART_ID = '44444444-4444-4444-8444-444444444444'
const OPERATOR_ID = '22222222-2222-4222-8222-222222222222'
const ORDER_ID = '33333333-3333-4333-8333-333333333333'

function createUpdateQueryBuilder(affected: number) {
  const qb: any = {
    update: jest.fn(() => qb),
    set: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    setParameters: jest.fn(() => qb),
    execute: jest.fn().mockResolvedValue({ affected }),
  }
  return qb
}

describe('PartsService', () => {
  let repo: any
  let logRepo: any
  let service: PartsService

  beforeEach(() => {
    repo = {
      manager: {
        transaction: jest.fn(),
      },
    }
    logRepo = {}
    service = new PartsService(repo, logRepo)
  })

  it('performs outbound as an atomic stock update and records a stock log', async () => {
    const qb = createUpdateQueryBuilder(1)
    const part = {
      id: PART_ID,
      projectId: PROJECT_ID,
      name: 'Power Module',
      unit: 'pcs',
      stock: 3,
      minStock: 5,
    } as SparePart
    const txPartRepo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn().mockResolvedValue(part),
    }
    const txLogRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    }
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === SparePart) return txPartRepo
        if (entity === SparePartLog) return txLogRepo
        throw new Error(`Unexpected repository ${entity}`)
      }),
    } as unknown as EntityManager
    repo.manager.transaction.mockImplementation(async (callback: any) => callback(manager))

    const result = await service.outbound(PART_ID, 2, OPERATOR_ID, ORDER_ID, 'used in repair', undefined, PROJECT_ID)

    expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
      stock: expect.any(Function),
      updatedAt: expect.any(Function),
    }))
    expect(qb.where).toHaveBeenCalledWith('id = :partId')
    expect(qb.andWhere).toHaveBeenCalledWith('"projectId" = :projectId')
    expect(qb.andWhere).toHaveBeenCalledWith('stock >= :quantity')
    expect(qb.setParameters).toHaveBeenCalledWith({ partId: PART_ID, quantity: 2, projectId: PROJECT_ID })
    expect(txLogRepo.save).toHaveBeenCalledWith({
      partId: PART_ID,
      opType: StockOpType.OUTBOUND,
      quantity: 2,
      operatorId: OPERATOR_ID,
      orderId: ORDER_ID,
      note: 'used in repair',
    })
    expect(result).toEqual({ part, stockAlert: true })
  })

  it('does not write a stock log when outbound fails for insufficient stock', async () => {
    const qb = createUpdateQueryBuilder(0)
    const txPartRepo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn().mockResolvedValue({
        id: PART_ID,
        name: 'Power Module',
        unit: 'pcs',
        stock: 1,
      }),
    }
    const txLogRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    }
    const manager = {
      getRepository: jest.fn((entity) => entity === SparePart ? txPartRepo : txLogRepo),
    } as unknown as EntityManager
    repo.manager.transaction.mockImplementation(async (callback: any) => callback(manager))

    await expect(service.outbound(PART_ID, 2, OPERATOR_ID, ORDER_ID, undefined, undefined, PROJECT_ID))
      .rejects.toThrow(BadRequestException)

    expect(txLogRepo.save).not.toHaveBeenCalled()
  })
})
