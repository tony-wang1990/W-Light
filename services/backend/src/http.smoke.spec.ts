import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { ProjectAccessGuard } from './common/guards/project-access.guard'
import { HealthModule } from './modules/health/health.module'
import { UserRole } from './modules/users/entities/user.entity'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222'

interface GuardedProjectRequest {
  projectId: string
}

class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const role = request.headers['x-test-role'] || UserRole.ENGINEER
    const projectHeader = request.headers['x-test-projects']
    const projectIds = typeof projectHeader === 'string'
      ? projectHeader.split(',').map((id) => id.trim()).filter(Boolean)
      : [PROJECT_ID]

    request.user = {
      id: 'user-1',
      role,
      projectIds,
    }
    return true
  }
}

@Controller('guarded-project')
@UseGuards(HeaderUserGuard, ProjectAccessGuard)
class GuardedProjectController {
  @Get()
  find(@Req() req: GuardedProjectRequest) {
    return { projectId: req.projectId }
  }
}

describe('HTTP smoke tests', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [GuardedProjectController],
      providers: [HeaderUserGuard, ProjectAccessGuard],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves the health endpoint under the production /v1 prefix', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok')
        expect(body.timestamp).toEqual(expect.any(String))
      })
  })

  it('rejects guarded routes without a project header', async () => {
    await request(app.getHttpServer())
      .get('/v1/guarded-project')
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Missing X-Project-Id header')
      })
  })

  it('rejects invalid project ids before hitting business logic', async () => {
    await request(app.getHttpServer())
      .get('/v1/guarded-project')
      .set('X-Project-Id', 'not-a-uuid')
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Invalid X-Project-Id header')
      })
  })

  it('rejects non-admin users outside their project scope', async () => {
    await request(app.getHttpServer())
      .get('/v1/guarded-project')
      .set('X-Project-Id', OTHER_PROJECT_ID)
      .set('X-Test-Projects', PROJECT_ID)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('No access to this project')
      })
  })

  it('passes the normalized project id to guarded business handlers', async () => {
    await request(app.getHttpServer())
      .get('/v1/guarded-project')
      .set('X-Project-Id', ` ${PROJECT_ID} `)
      .set('X-Test-Projects', PROJECT_ID)
      .expect(200)
      .expect(({ body }) => {
        expect(body.projectId).toBe(PROJECT_ID)
      })
  })

  it('allows admins to access any valid project id', async () => {
    await request(app.getHttpServer())
      .get('/v1/guarded-project')
      .set('X-Project-Id', OTHER_PROJECT_ID)
      .set('X-Test-Role', UserRole.ADMIN)
      .set('X-Test-Projects', '')
      .expect(200)
      .expect(({ body }) => {
        expect(body.projectId).toBe(OTHER_PROJECT_ID)
      })
  })
})
