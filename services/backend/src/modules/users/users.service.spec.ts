import { WorkOrder } from '../orders/entities/order.entity'
import { User, UserRole } from './entities/user.entity'
import { UsersService } from './users.service'

const PROJECT_A = '11111111-1111-4111-8111-111111111111'
const PROJECT_B = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ENGINEER_A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ENGINEER_B_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function user(partial: Partial<User>): User {
  return {
    id: partial.id || ENGINEER_A_ID,
    name: partial.name || 'User',
    phone: partial.phone || '13800000000',
    passwordHash: 'secret-hash',
    role: partial.role || UserRole.ENGINEER,
    projectIds: partial.projectIds || [],
    skillTags: [],
    fcmToken: 'push-token',
    isActive: true,
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    updatedAt: new Date('2026-06-07T00:00:00.000Z'),
  } as User
}

function createWorkloadQueryBuilder(rows: Array<{ assigneeId: string; count: string }>) {
  const qb: any = {
    select: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    groupBy: jest.fn(() => qb),
    getRawMany: jest.fn().mockResolvedValue(rows),
  }
  return qb
}

describe('UsersService', () => {
  let repo: any
  let orderRepo: any
  let service: UsersService

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([
        user({ id: ADMIN_ID, name: 'Admin', role: UserRole.ADMIN, projectIds: [PROJECT_A, PROJECT_B] }),
        user({ id: ENGINEER_A_ID, name: 'Engineer A', role: UserRole.ENGINEER, projectIds: [PROJECT_A] }),
        user({ id: ENGINEER_B_ID, name: 'Engineer B', role: UserRole.ENGINEER, projectIds: [PROJECT_B] }),
      ]),
    }
    orderRepo = {
      createQueryBuilder: jest.fn(),
    }
    service = new UsersService(repo, orderRepo)
  })

  it('filters users by requested project and hides sensitive fields', async () => {
    const result = await service.findAll(PROJECT_A, false, { role: UserRole.ADMIN, projectIds: [] })

    expect(result.map(item => item.id)).toEqual([ADMIN_ID, ENGINEER_A_ID])
    expect(result[0]).not.toHaveProperty('passwordHash')
    expect(result[0]).not.toHaveProperty('fcmToken')
  })

  it('limits non-admin requesters to their own projects', async () => {
    const result = await service.findAll(undefined, false, {
      role: UserRole.ENGINEER,
      projectIds: [PROJECT_A],
    })

    expect(result.map(item => item.id)).toEqual([ADMIN_ID, ENGINEER_A_ID])
  })

  it('applies role filters after project visibility filtering', async () => {
    const result = await service.findAll(PROJECT_A, false, {
      role: UserRole.ADMIN,
      projectIds: [],
    }, UserRole.ENGINEER)

    expect(result.map(item => item.id)).toEqual([ENGINEER_A_ID])
  })

  it('adds workload and busy status when requested for a scoped project', async () => {
    const qb = createWorkloadQueryBuilder([{ assigneeId: ENGINEER_A_ID, count: '3' }])
    orderRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.findAll(PROJECT_A, true, {
      role: UserRole.ADMIN,
      projectIds: [],
    }, UserRole.ENGINEER)

    expect(qb.where).toHaveBeenCalledWith('o."projectId" = :projectId', { projectId: PROJECT_A })
    expect(qb.andWhere).toHaveBeenCalledWith('o."assigneeId" IN (:...userIds)', { userIds: [ENGINEER_A_ID] })
    expect(result).toEqual([
      expect.objectContaining({
        id: ENGINEER_A_ID,
        activeOrderCount: 3,
        busyStatus: 'overloaded',
      }),
    ])
  })
})
