import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { UserRole } from '../../modules/users/entities/user.entity'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeHeaderProjectId(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeHeaderProjectId(value[0])
  if (typeof value !== 'string') return null
  const projectId = value.trim()
  return projectId || null
}

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user) {
      throw new ForbiddenException('No user in request')
    }

    const projectId = normalizeHeaderProjectId(request.headers['x-project-id'])
    if (!projectId) {
      throw new BadRequestException('Missing X-Project-Id header')
    }
    if (!UUID_PATTERN.test(projectId)) {
      throw new BadRequestException('Invalid X-Project-Id header')
    }

    request.projectId = projectId

    if (user.role === UserRole.ADMIN) return true
    if (Array.isArray(user.projectIds) && user.projectIds.includes(projectId)) return true

    throw new ForbiddenException('No access to this project')
  }
}
