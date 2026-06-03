import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { ProjectAccessGuard } from './project-access.guard'
import { UserRole } from '../../modules/users/entities/user.entity'

function createContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
}

describe('ProjectAccessGuard', () => {
  const guard = new ProjectAccessGuard()

  it('requires X-Project-Id', () => {
    const request = {
      headers: {},
      user: { role: UserRole.ENGINEER, projectIds: ['project-a'] },
    }

    expect(() => guard.canActivate(createContext(request))).toThrow(BadRequestException)
  })

  it('allows admins and stores the scoped project id', () => {
    const request = {
      headers: { 'x-project-id': 'project-b' },
      user: { role: UserRole.ADMIN, projectIds: [] },
    }

    expect(guard.canActivate(createContext(request))).toBe(true)
    expect(request).toHaveProperty('projectId', 'project-b')
  })

  it('allows users assigned to the requested project', () => {
    const request = {
      headers: { 'x-project-id': 'project-a' },
      user: { role: UserRole.ENGINEER, projectIds: ['project-a'] },
    }

    expect(guard.canActivate(createContext(request))).toBe(true)
    expect(request).toHaveProperty('projectId', 'project-a')
  })

  it('rejects users outside the requested project', () => {
    const request = {
      headers: { 'x-project-id': 'project-b' },
      user: { role: UserRole.ENGINEER, projectIds: ['project-a'] },
    }

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException)
  })
})
