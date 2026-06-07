import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UserRole } from './entities/user.entity'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

const PROJECT_A = '11111111-1111-4111-8111-111111111111'
const PROJECT_B = '22222222-2222-4222-8222-222222222222'

describe('UsersController', () => {
  let usersService: jest.Mocked<UsersService>
  let controller: UsersController

  beforeEach(() => {
    usersService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<UsersService>
    controller = new UsersController(usersService)
  })

  it('uses the project query parameter when listing users', async () => {
    const req = {
      headers: { 'x-project-id': PROJECT_B },
      user: { role: UserRole.ADMIN, projectIds: [] },
    }
    usersService.findAll.mockResolvedValue([])

    await controller.findAll(req, PROJECT_A, '1', UserRole.ENGINEER)

    expect(usersService.findAll).toHaveBeenCalledWith(
      PROJECT_A,
      true,
      req.user,
      UserRole.ENGINEER,
    )
  })

  it('falls back to X-Project-Id and rejects users outside that project', () => {
    const req = {
      headers: { 'x-project-id': PROJECT_B },
      user: { role: UserRole.ENGINEER, projectIds: [PROJECT_A] },
    }

    expect(() => controller.findAll(req, undefined, undefined, undefined)).toThrow(ForbiddenException)
    expect(usersService.findAll).not.toHaveBeenCalled()
  })

  it('rejects malformed project ids before they reach service queries', () => {
    const req = {
      headers: { 'x-project-id': 'project-a' },
      user: { role: UserRole.ADMIN, projectIds: [] },
    }

    expect(() => controller.findAll(req, undefined, 'true', undefined)).toThrow(BadRequestException)
    expect(usersService.findAll).not.toHaveBeenCalled()
  })
})
