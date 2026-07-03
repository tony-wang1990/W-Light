import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource, Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import request = require('supertest')
import { DeviceCategory } from './modules/devices/entities/device.entity'
import { InspectionFrequency } from './modules/inspections/entities/inspection-plan.entity'
import { InspectionStatus } from './modules/inspections/entities/inspection-record.entity'
import { OrderCategory, OrderPriority, OrderStatus } from './modules/orders/entities/order.entity'
import { Project } from './modules/projects/entities/project.entity'
import { User, UserRole } from './modules/users/entities/user.entity'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID = '33333333-3333-4333-8333-333333333333'
const ENGINEER_ID = '44444444-4444-4444-8444-444444444444'
const VIEWER_ID = '55555555-5555-4555-8555-555555555555'
const PASSWORD = 'WLight@2026'

jest.setTimeout(30_000)

function configureE2eEnvironment() {
  const dbType = process.env.E2E_DB_TYPE || 'sqljs'

  process.env.NODE_ENV = 'test'
  process.env.DB_TYPE = dbType
  process.env.DB_SYNCHRONIZE = process.env.DB_SYNCHRONIZE || 'true'
  process.env.DB_MIGRATIONS_RUN = process.env.DB_MIGRATIONS_RUN || 'false'
  process.env.DB_LOGGING = process.env.DB_LOGGING || 'false'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_lightops_e2e_at_least_32_chars'

  if (dbType === 'sqljs') {
    delete process.env.DB_DATABASE
  }
}

describe('App HTTP e2e flow', () => {
  let app: INestApplication
  let dataSource: DataSource
  let userRepo: Repository<User>
  let projectRepo: Repository<Project>
  let adminToken: string
  let engineerToken: string
  let viewerToken: string

  beforeAll(async () => {
    configureE2eEnvironment()

    const { AppModule } = await import('./app.module')
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    dataSource = app.get(DataSource)
    await dataSource.dropDatabase()
    await dataSource.synchronize()

    userRepo = dataSource.getRepository(User)
    projectRepo = dataSource.getRepository(Project)

    await seedFixture()
    adminToken = await login('13800000001')
    engineerToken = await login('13800000002')
    viewerToken = await login('13800000003')
  })

  afterAll(async () => {
    await app?.close()
  })

  async function seedFixture() {
    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    await userRepo.save([
      userRepo.create({
        id: ADMIN_ID,
        name: 'System Admin',
        phone: '13800000001',
        passwordHash,
        role: UserRole.ADMIN,
        projectIds: [PROJECT_ID],
        skillTags: [],
        isActive: true,
      }),
      userRepo.create({
        id: ENGINEER_ID,
        name: '现场工程师',
        phone: '13800000002',
        passwordHash,
        role: UserRole.ENGINEER,
        projectIds: [PROJECT_ID],
        skillTags: ['灯具维修'],
        isActive: true,
      }),
      userRepo.create({
        id: VIEWER_ID,
        name: '只读用户',
        phone: '13800000003',
        passwordHash,
        role: UserRole.VIEWER,
        projectIds: [PROJECT_ID],
        skillTags: [],
        isActive: true,
      }),
    ])

    await projectRepo.save(projectRepo.create({
      id: PROJECT_ID,
      name: 'W-LightOps Sample Project',
      venue: '文旅演艺广场',
      address: '主舞台',
      managerId: ADMIN_ID,
    }))
  }

  async function login(phone: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ phone, password: PASSWORD, projectId: PROJECT_ID })
      .expect(201)

    expect(response.body.accessToken).toEqual(expect.any(String))
    expect(response.body.user.passwordHash).toBeUndefined()
    return response.body.accessToken as string
  }

  function auth(token = adminToken, projectId = PROJECT_ID) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Project-Id': projectId,
    }
  }

  it('authenticates users and exposes project scoped account data', async () => {
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set(auth(adminToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(ADMIN_ID)
        expect(body.passwordHash).toBeUndefined()
        expect(body.projectIds).toContain(PROJECT_ID)
      })

    await request(app.getHttpServer())
      .get('/v1/projects')
      .set(auth(engineerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1)
        expect(body[0].id).toBe(PROJECT_ID)
      })
  })

  it('rejects invalid project headers before business handlers run', async () => {
    await request(app.getHttpServer())
      .get('/v1/devices')
      .set(auth(adminToken, 'not-a-uuid'))
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Invalid X-Project-Id header')
      })

    await request(app.getHttpServer())
      .get('/v1/devices')
      .set(auth(engineerToken, OTHER_PROJECT_ID))
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('No access to this project')
      })
  })

  it('protects admin-only write routes from viewer accounts', async () => {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set(auth(viewerToken))
      .send({
        deviceNo: 'VIEWER-DENIED',
        name: 'Viewer should not create devices',
        category: DeviceCategory.LIGHT,
      })
      .expect(403)
  })

  it('runs the work order repair and acceptance flow through real HTTP routes', async () => {
    const device = await request(app.getHttpServer())
      .post('/v1/devices')
      .set(auth())
      .send({
        deviceNo: 'DEV-E2E-001',
        name: '主舞台摇头灯 01',
        qrCode: 'QR-E2E-001',
        category: DeviceCategory.LIGHT,
        model: 'Beam 380',
        location: '主舞台左侧灯架',
        dmxAddress: 101,
        channelCount: 16,
        power: 380,
      })
      .expect(201)
      .then(res => res.body)

    const part = await request(app.getHttpServer())
      .post('/v1/parts')
      .set(auth())
      .send({
        name: '电源模块',
        model: 'PSU-380',
        unit: '个',
        stock: 3,
        minStock: 1,
      })
      .expect(201)
      .then(res => res.body)

    const order = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth())
      .send({
        deviceId: device.id,
        category: OrderCategory.FAULT,
        priority: OrderPriority.P2,
        faultType: '不亮',
        faultDesc: '通电后灯具不亮，需要现场检查电源模块',
        locationDesc: '主舞台左侧',
      })
      .expect(201)
      .then(res => res.body)

    expect(order.orderNo).toMatch(/^WO-\d{8}-0001$/)
    expect(order.status).toBe(OrderStatus.PENDING)

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/assign`)
      .set(auth())
      .send({ assigneeId: ENGINEER_ID })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.ASSIGNED)
        expect(body.assigneeId).toBe(ENGINEER_ID)
      })

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/accept`)
      .set(auth(engineerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.PROCESSING)
      })

    const repairLog = await request(app.getHttpServer())
      .post(`/v1/orders/${order.id}/repair-logs`)
      .set(auth(engineerToken))
      .send({
        stepType: '更换',
        stepDesc: '更换损坏电源模块并重新上电测试',
        partUsages: [{ partId: part.id, quantity: 2, note: '更换电源模块' }],
      })
      .expect(201)
      .then(res => res.body)

    expect(repairLog.partUsages).toEqual([
      expect.objectContaining({ partId: part.id, name: '电源模块', quantity: 2, unit: '个' }),
    ])

    await request(app.getHttpServer())
      .get(`/v1/parts/${part.id}`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(Number(body.stock)).toBe(1)
      })

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/submit`)
      .set(auth(engineerToken))
      .send({ repairCost: 128 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.REVIEWING)
      })

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/accept-check`)
      .set(auth())
      .send({ note: '现场复测通过' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.CLOSED)
        expect(body.acceptanceNote).toBe('现场复测通过')
      })

    await request(app.getHttpServer())
      .get(`/v1/orders/${order.id}/repair-logs`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1)
        expect(body[0].engineerId).toBe(ENGINEER_ID)
      })

    await request(app.getHttpServer())
      .get('/v1/orders')
      .query({ keyword: '电源模块' })
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1)
        expect(body.items[0].status).toBe(OrderStatus.CLOSED)
      })

    await request(app.getHttpServer())
      .get('/v1/orders/summary')
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body[OrderStatus.CLOSED]).toBe(1)
      })
  })

  it('lets a newly created project engineer log in and accept an assigned order', async () => {
    const engineerPhone = '13800000121'
    const createdEngineer = await request(app.getHttpServer())
      .post('/v1/users')
      .set(auth())
      .send({
        name: '新建接单测试工程师',
        phone: engineerPhone,
        password: PASSWORD,
        role: UserRole.ENGINEER,
        projectIds: [PROJECT_ID],
        skillTags: ['灯具维修'],
      })
      .expect(201)
      .then(res => res.body)

    expect(createdEngineer.passwordHash).toBeUndefined()
    expect(createdEngineer.projectIds).toContain(PROJECT_ID)

    const newEngineerToken = await login(engineerPhone)
    const order = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth())
      .send({
        category: OrderCategory.FAULT,
        priority: OrderPriority.P2,
        faultDesc: '验证新建账号在 Android 与 Web 共用接口接单',
      })
      .expect(201)
      .then(res => res.body)

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/assign`)
      .set(auth())
      .send({ assigneeId: createdEngineer.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.ASSIGNED)
        expect(body.assigneeId).toBe(createdEngineer.id)
      })

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/accept`)
      .set(auth(newEngineerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(OrderStatus.PROCESSING)
        expect(body.assigneeId).toBe(createdEngineer.id)
      })
  })

  it('rejects assigning repair orders to an incompatible account', async () => {
    const inspector = await request(app.getHttpServer())
      .post('/v1/users')
      .set(auth())
      .send({
        name: '巡检角色测试账号',
        phone: '13800000122',
        password: PASSWORD,
        role: UserRole.INSPECTOR,
        projectIds: [PROJECT_ID],
      })
      .expect(201)
      .then(res => res.body)

    const order = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth())
      .send({
        category: OrderCategory.FAULT,
        priority: OrderPriority.P2,
        faultDesc: '验证无效派单对象会在派单阶段被阻止',
      })
      .expect(201)
      .then(res => res.body)

    await request(app.getHttpServer())
      .put(`/v1/orders/${order.id}/assign`)
      .set(auth())
      .send({ assigneeId: inspector.id })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('只有管理员或维修工程师')
      })
  })

  it('runs device, parts, inspection, notification and report interactions through real routes', async () => {
    const inspectorPhone = '13800000123'
    const inspector = await request(app.getHttpServer())
      .post('/v1/users')
      .set(auth())
      .send({
        name: '全端巡检测试员',
        phone: inspectorPhone,
        password: PASSWORD,
        role: UserRole.INSPECTOR,
        projectIds: [PROJECT_ID],
      })
      .expect(201)
      .then(res => res.body)
    const inspectorToken = await login(inspectorPhone)

    const device = await request(app.getHttpServer())
      .post('/v1/devices')
      .set(auth())
      .send({
        deviceNo: 'FULL-E2E-DEVICE',
        name: '全端交互测试灯具',
        qrCode: 'FULL-E2E-QR',
        category: DeviceCategory.LIGHT,
        location: '测试区域 A',
      })
      .expect(201)
      .then(res => res.body)

    await request(app.getHttpServer())
      .put(`/v1/devices/${device.id}`)
      .set(auth())
      .send({ location: '测试区域 B' })
      .expect(200)

    await request(app.getHttpServer())
      .get('/v1/devices/scan/FULL-E2E-QR')
      .set(auth(inspectorToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.device.id).toBe(device.id)
        expect(body.device.location).toBe('测试区域 B')
      })

    const part = await request(app.getHttpServer())
      .post('/v1/parts')
      .set(auth())
      .send({
        name: '全端测试保险丝',
        model: 'FUSE-E2E',
        unit: '只',
        stock: 2,
        minStock: 1,
      })
      .expect(201)
      .then(res => res.body)

    await request(app.getHttpServer())
      .post(`/v1/parts/${part.id}/inbound`)
      .set(auth())
      .send({ quantity: 3, note: '全端入库测试' })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/v1/parts/${part.id}/outbound`)
      .set(auth(engineerToken))
      .send({ quantity: 1, note: '全端出库测试' })
      .expect(201)

    await request(app.getHttpServer())
      .get(`/v1/parts/${part.id}/logs`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.length).toBeGreaterThanOrEqual(2)
      })

    const plan = await request(app.getHttpServer())
      .post('/v1/inspections/plans')
      .set(auth())
      .send({
        name: '全端巡检交互计划',
        frequency: InspectionFrequency.DAILY,
        deviceIds: [device.id],
        assigneeId: inspector.id,
        nextInspectionAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(201)
      .then(res => res.body)

    await request(app.getHttpServer())
      .get('/v1/inspections/today')
      .set(auth(inspectorToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.some((item: { id: string }) => item.id === plan.id)).toBe(true)
      })

    await request(app.getHttpServer())
      .post('/v1/inspections/records')
      .set(auth(engineerToken))
      .send({
        planId: plan.id,
        status: InspectionStatus.NORMAL,
        resultDesc: '非责任人不应提交该巡检计划',
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toContain('已指派给其他人员')
      })

    const inspectionRecord = await request(app.getHttpServer())
      .post('/v1/inspections/records')
      .set(auth(inspectorToken))
      .send({
        planId: plan.id,
        status: InspectionStatus.ABNORMAL,
        resultDesc: '巡检发现灯具频闪',
        createOrder: true,
      })
      .expect(201)
      .then(res => res.body)

    expect(inspectionRecord.orderId).toEqual(expect.any(String))

    await request(app.getHttpServer())
      .get(`/v1/orders/${inspectionRecord.orderId}`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.deviceId).toBe(device.id)
        expect(body.status).toBe(OrderStatus.PENDING)
      })

    await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth(viewerToken))
      .send({
        category: OrderCategory.FAULT,
        priority: OrderPriority.P2,
        faultDesc: '只读账号不应创建工单',
      })
      .expect(403)

    await request(app.getHttpServer())
      .get('/v1/reports/operations-summary')
      .set(auth(viewerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.overview).toBeDefined()
      })

    await request(app.getHttpServer())
      .get('/v1/reports/export/orders.xlsx')
      .set(auth())
      .expect(200)
      .expect('Content-Type', /spreadsheetml/)

    await new Promise(resolve => setTimeout(resolve, 50))
    const notifications = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set(auth(engineerToken))
      .expect(200)
      .then(res => res.body)

    expect(Array.isArray(notifications.items)).toBe(true)

    await request(app.getHttpServer())
      .put('/v1/notifications/read-all')
      .set(auth(engineerToken))
      .expect(200)
  })
})
