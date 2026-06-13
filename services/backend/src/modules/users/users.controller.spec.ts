import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UserRole } from './entities/user.entity'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

function createController() {
  const usersService = {
    findAll: jest.fn(async () => []),
  }

  return {
    controller: new UsersController(usersService as never),
    usersService,
  }
}

function request(role: UserRole, projectIds: string[] = [PROJECT_ID], headers: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      role,
      projectIds,
    },
    headers,
  }
}

describe('UsersController permission hardening', () => {
  it('requires project context when a non-admin lists users', () => {
    const { controller } = createController()

    expect(() => controller.findAll(request(UserRole.ENGINEER) as never))
      .toThrow(BadRequestException)
  })

  it('blocks workload metrics for non-admin users', () => {
    const { controller } = createController()

    expect(() => controller.findAll(
      request(UserRole.ENGINEER, [PROJECT_ID], { 'x-project-id': PROJECT_ID }) as never,
      undefined,
      'true',
    )).toThrow(ForbiddenException)
  })

  it('allows project-scoped basic user lists for authenticated project members', async () => {
    const { controller, usersService } = createController()
    const req = request(UserRole.ENGINEER, [PROJECT_ID], { 'x-project-id': PROJECT_ID })

    await expect(controller.findAll(req as never, undefined, undefined, UserRole.ENGINEER)).resolves.toEqual([])

    expect(usersService.findAll).toHaveBeenCalledWith(PROJECT_ID, false, req.user, UserRole.ENGINEER)
  })

  it('allows admins to request workload metrics', async () => {
    const { controller, usersService } = createController()
    const req = request(UserRole.ADMIN)

    await expect(controller.findAll(req as never, PROJECT_ID, 'true')).resolves.toEqual([])

    expect(usersService.findAll).toHaveBeenCalledWith(PROJECT_ID, true, req.user, undefined)
  })
})
