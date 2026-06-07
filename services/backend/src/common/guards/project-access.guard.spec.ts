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
  const projectA = '11111111-1111-4111-8111-111111111111'
  const projectB = '22222222-2222-4222-8222-222222222222'

  it('requires X-Project-Id', () => {
    const request = {
      headers: {},
      user: { role: UserRole.ENGINEER, projectIds: [projectA] },
    }

    expect(() => guard.canActivate(createContext(request))).toThrow(BadRequestException)
  })

  it('rejects malformed project ids before querying project scoped data', () => {
    const request = {
      headers: { 'x-project-id': 'project-a' },
      user: { role: UserRole.ADMIN, projectIds: [] },
    }

    expect(() => guard.canActivate(createContext(request))).toThrow(BadRequestException)
  })

  it('allows admins and stores the scoped project id', () => {
    const request = {
      headers: { 'x-project-id': projectB },
      user: { role: UserRole.ADMIN, projectIds: [] },
    }

    expect(guard.canActivate(createContext(request))).toBe(true)
    expect(request).toHaveProperty('projectId', projectB)
  })

  it('allows users assigned to the requested project', () => {
    const request = {
      headers: { 'x-project-id': projectA },
      user: { role: UserRole.ENGINEER, projectIds: [projectA] },
    }

    expect(guard.canActivate(createContext(request))).toBe(true)
    expect(request).toHaveProperty('projectId', projectA)
  })

  it('rejects users outside the requested project', () => {
    const request = {
      headers: { 'x-project-id': projectB },
      user: { role: UserRole.ENGINEER, projectIds: [projectA] },
    }

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException)
  })
})
