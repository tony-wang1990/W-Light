/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use lightweight TypeORM repository mocks. */

import { DataSource } from 'typeorm'
import { OrderCategory, OrderPriority } from '../orders/entities/order.entity'
import { OrdersService } from '../orders/orders.service'
import { InspectionFrequency, InspectionPlan } from './entities/inspection-plan.entity'
import { InspectionStatus } from './entities/inspection-record.entity'
import { InspectionsService } from './inspections.service'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const INSPECTOR_ID = '22222222-2222-4222-8222-222222222222'
const PLAN_ID = '33333333-3333-4333-8333-333333333333'
const DEVICE_ID = '44444444-4444-4444-8444-444444444444'
const ORDER_ID = '55555555-5555-4555-8555-555555555555'

function createPagedQueryBuilder() {
  const qb: any = {
    innerJoin: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }
  return qb
}

describe('InspectionsService', () => {
  let planRepo: any
  let recordRepo: any
  let dataSource: jest.Mocked<DataSource>
  let ordersService: jest.Mocked<OrdersService>
  let service: InspectionsService

  beforeEach(() => {
    planRepo = {}
    recordRepo = {}
    dataSource = {
      options: { type: 'postgres' },
    } as unknown as jest.Mocked<DataSource>
    ordersService = {
      create: jest.fn(),
    } as unknown as jest.Mocked<OrdersService>
    service = new InspectionsService(planRepo, recordRepo, dataSource, ordersService)
  })

  it('uses entity property paths for paged record ordering', async () => {
    const qb = createPagedQueryBuilder()
    recordRepo.createQueryBuilder = jest.fn(() => qb)

    await service.getRecords(PROJECT_ID, PLAN_ID, 2, 5)

    expect(qb.innerJoin.mock.calls[0][2]).toContain('CAST(p.id AS text) = CAST(r."planId" AS text)')
    expect(qb.innerJoin.mock.calls[0][2]).toContain('CAST(p."projectId" AS text) = :projectId')
    expect(qb.orderBy).toHaveBeenCalledWith('r.inspectedAt', 'DESC')
    expect(qb.andWhere).toHaveBeenCalledWith('CAST(r."planId" AS text) = :planId', { planId: PLAN_ID })
    expect(qb.skip).toHaveBeenCalledWith(5)
    expect(qb.take).toHaveBeenCalledWith(5)
  })

  it('creates a repair order for abnormal inspection records and advances the plan schedule', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-07T02:00:00.000Z'))
    const plan = {
      id: PLAN_ID,
      projectId: PROJECT_ID,
      name: 'Main stage weekly check',
      frequency: InspectionFrequency.WEEKLY,
      deviceIds: [DEVICE_ID],
      nextInspectionAt: new Date('2026-06-07T02:00:00.000Z'),
    } as InspectionPlan
    planRepo.findOne = jest.fn().mockResolvedValue(plan)
    planRepo.save = jest.fn(async (value) => value)
    recordRepo.create = jest.fn((value) => value)
    recordRepo.save = jest.fn(async (value) => ({ id: 'record-id', ...value }))
    ordersService.create.mockResolvedValue({ id: ORDER_ID } as any)

    const record = await service.createRecord({
      planId: PLAN_ID,
      status: InspectionStatus.ABNORMAL,
      resultDesc: 'Fixture is flickering',
      createOrder: true,
    }, INSPECTOR_ID, PROJECT_ID)

    expect(ordersService.create).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: DEVICE_ID,
      category: OrderCategory.FAULT,
      priority: OrderPriority.P2,
      faultType: expect.any(String),
      faultDesc: expect.stringContaining('Fixture is flickering'),
      locationDesc: plan.name,
    }), INSPECTOR_ID, PROJECT_ID)
    expect(recordRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      planId: PLAN_ID,
      inspectorId: INSPECTOR_ID,
      orderId: ORDER_ID,
      status: InspectionStatus.ABNORMAL,
    }))
    expect(record).toMatchObject({ id: 'record-id', orderId: ORDER_ID })
    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: PLAN_ID,
      nextInspectionAt: new Date('2026-06-14T02:00:00.000Z'),
    }))
    jest.useRealTimers()
  })
})
