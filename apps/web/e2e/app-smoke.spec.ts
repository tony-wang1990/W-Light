import { expect, Page, Route, test } from '@playwright/test'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const ORDER_ID = '22222222-2222-4222-8222-222222222222'
const ENGINEER_ID = '33333333-3333-4333-8333-333333333333'
const PART_ID = '44444444-4444-4444-8444-444444444444'

function response(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  })
}

function operationsSummary() {
  return {
    overview: {
      totalOrders: 0,
      faultOrders: 0,
      closedOrders: 0,
      overtimeOrders: 0,
      deviceCount: 0,
      faultRateByOrders: 0,
      faultRateByDevices: 0,
      avgRepairHours: 0,
      avgResponseHours: 0,
    },
    faultTypes: [],
    repeatFaultDevices: [],
    engineerPerformance: [],
    partsConsumption: [],
  }
}

interface MockOrder {
  id: string
  orderNo: string
  faultDesc: string
  status: string
  priority: string
  category: string
  createdAt: string
  assignedAt?: string
  startedAt?: string
  submittedAt?: string
  closedAt?: string
  assigneeName?: string
  assignee?: {
    id: string
    name: string
    role: string
    phone?: string
  } | null
  reporter?: {
    id: string
    name: string
    role: string
    phone?: string
  }
  device?: {
    id: string
    name: string
    deviceNo: string
    location: string
  }
  acceptanceNote?: string
}

interface RepairPartUsage {
  partId: string
  quantity: number
  note?: string
}

interface RepairLogBody {
  stepType?: string
  stepDesc?: string
  outsourceVendor?: string
  outsourceCost?: number
  partUsages?: RepairPartUsage[]
}

interface RepairLog extends RepairLogBody {
  id: string
  loggedAt: string
  engineer: {
    name: string
  }
  partUsages?: Array<RepairPartUsage & {
    name: string
    unit: string
  }>
}

function parseJsonBody<T>(route: Route, fallback: T): T {
  const raw = route.request().postData()
  if (!raw) return fallback
  return JSON.parse(raw) as T
}

async function mockApi(page: Page) {
  await page.route('**/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/v1/, '') || '/'

    if (request.method() === 'POST' && path === '/auth/login') {
      return response(route, {
        accessToken: 'playwright-token',
        user: {
          id: 'admin-1',
          name: 'System Admin',
          phone: '13800000001',
          role: 'admin',
          projectIds: [PROJECT_ID],
        },
      })
    }

    if (request.method() === 'GET' && path === '/projects') {
      return response(route, [{ id: PROJECT_ID, name: 'W-LightOps Sample Project' }])
    }

    if (request.method() === 'GET' && path === '/projects/overview') {
      return response(route, [{
        id: PROJECT_ID,
        name: 'W-LightOps Sample Project',
        status: 'active',
        deviceCount: 0,
        orderCount: 0,
        openOrderCount: 0,
        overtimeOrderCount: 0,
        partCount: 0,
        lowStockCount: 0,
        inspectionPlanCount: 0,
      }])
    }

    if (request.method() === 'GET' && path === '/reports/operations-summary') {
      return response(route, operationsSummary())
    }

    if (request.method() === 'GET' && [
      '/reports/weekly-trend',
      '/reports/device-status',
      '/reports/parts-rank',
    ].includes(path)) {
      return response(route, [])
    }

    if (request.method() === 'GET' && path === '/inspections/stats') {
      return response(route, { totalPlans: 0, todayRecords: 0 })
    }

    if (request.method() === 'GET' && path === '/inspections/plans') {
      return response(route, [])
    }

    if (request.method() === 'GET' && path === '/inspections/records') {
      return response(route, { items: [], total: 0 })
    }

    if (request.method() === 'GET' && path === '/orders') {
      return response(route, { items: [], total: 0 })
    }

    if (request.method() === 'GET' && path === '/devices') {
      return response(route, { items: [], total: 0 })
    }

    if (request.method() === 'GET' && path === '/parts') {
      return response(route, { items: [], total: 0 })
    }

    if (request.method() === 'GET' && path === '/users') {
      return response(route, { items: [], total: 0 })
    }

    if (request.method() === 'GET' && path.includes('/sse/orders')) {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
    }

    return response(route, {})
  })
}

async function mockOrderWorkflowApi(page: Page) {
  const now = '2026-06-08T09:00:00.000Z'
  const engineer = {
    id: ENGINEER_ID,
    name: '维修工程师',
    role: 'engineer',
    phone: '13800000002',
  }
  const reporter = {
    id: 'reporter-1',
    name: '现场报修人',
    role: 'admin',
    phone: '13800000001',
  }
  const device = {
    id: 'device-1',
    name: '主舞台光束灯 01',
    deviceNo: 'DEV-2026-0001',
    location: '主舞台 TRUSS A',
  }
  let order: MockOrder = {
    id: ORDER_ID,
    orderNo: 'WO-20260608-0001',
    faultDesc: '光束灯频闪且不受控',
    status: 'pending',
    priority: 'P1',
    category: '故障维修',
    createdAt: now,
    assignee: null,
    reporter,
    device,
  }
  let logs: RepairLog[] = []
  let partStock = 5

  await page.route('**/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/v1/, '') || '/'

    if (request.method() === 'POST' && path === '/auth/login') {
      return response(route, {
        accessToken: 'playwright-token',
        user: {
          id: 'admin-1',
          name: 'System Admin',
          phone: '13800000001',
          role: 'admin',
          projectIds: [PROJECT_ID],
        },
      })
    }

    if (request.method() === 'GET' && path === '/projects') {
      return response(route, [{ id: PROJECT_ID, name: 'W-LightOps Sample Project' }])
    }

    if (request.method() === 'GET' && path === '/reports/operations-summary') {
      return response(route, operationsSummary())
    }

    if (request.method() === 'GET' && path === '/orders') {
      return response(route, { items: [order], total: 1 })
    }

    if (request.method() === 'GET' && path === `/orders/${ORDER_ID}`) {
      return response(route, order)
    }

    if (request.method() === 'GET' && path === `/orders/${ORDER_ID}/repair-logs`) {
      return response(route, { items: logs, total: logs.length })
    }

    if (request.method() === 'GET' && path === '/users') {
      return response(route, { items: [engineer], total: 1 })
    }

    if (request.method() === 'GET' && path === '/parts') {
      return response(route, {
        items: [{
          id: PART_ID,
          name: '保险丝',
          model: '5A',
          unit: '件',
          stock: partStock,
        }],
        total: 1,
      })
    }

    if (request.method() === 'PUT' && path === `/orders/${ORDER_ID}/assign`) {
      order = {
        ...order,
        status: 'assigned',
        assignedAt: now,
        assignee: engineer,
        assigneeName: engineer.name,
      }
      return response(route, order)
    }

    if (request.method() === 'PUT' && path === `/orders/${ORDER_ID}/accept`) {
      order = {
        ...order,
        status: 'processing',
        startedAt: now,
      }
      return response(route, order)
    }

    if (request.method() === 'POST' && path === `/orders/${ORDER_ID}/repair-logs`) {
      const body = parseJsonBody<RepairLogBody>(route, {})
      const partUsages = body.partUsages?.map((usage) => {
        partStock -= Number(usage.quantity || 0)
        return {
          ...usage,
          name: '保险丝',
          unit: '件',
        }
      })
      logs = [{
        id: 'log-1',
        stepType: body.stepType,
        stepDesc: body.stepDesc,
        outsourceVendor: body.outsourceVendor,
        outsourceCost: body.outsourceCost,
        partUsages,
        loggedAt: now,
        engineer: { name: engineer.name },
      }]
      return response(route, logs[0], 201)
    }

    if (request.method() === 'PUT' && path === `/orders/${ORDER_ID}/submit`) {
      order = {
        ...order,
        status: 'reviewing',
        submittedAt: now,
      }
      return response(route, order)
    }

    if (request.method() === 'PUT' && path === `/orders/${ORDER_ID}/accept-check`) {
      order = {
        ...order,
        status: 'closed',
        closedAt: now,
        acceptanceNote: '验收通过',
      }
      return response(route, order)
    }

    if (request.method() === 'GET' && path.includes('/sse/orders')) {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
    }

    return response(route, {})
  })
}

async function login(page: Page) {
  await page.goto('/login')

  await page.getByLabel('服务器地址').fill('/v1')
  await page.getByLabel('账号').fill('13800000001')
  await page.getByLabel('密码').fill('WLight@2026')
  await page.getByRole('button', { name: '登录控制台' }).click()

  await expect(page.getByRole('heading', { name: '控制台概览' })).toBeVisible()
}

test('login and key operations pages render without server errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await mockApi(page)
  await login(page)

  const pages = [
    ['工单调度中心', '工单调度中心'],
    ['维修记录台账', '维修记录台账'],
    ['巡检管理', '巡检管理'],
    ['报表与数据', '报表与数据'],
    ['专业工具箱', '专业工具箱'],
    ['客户端下载中心', '客户端下载中心'],
  ] as const

  for (const [menuTitle, heading] of pages) {
    await page.locator(`a[title="${menuTitle}"]`).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.getByText('Internal server error')).toHaveCount(0)
  }

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('every admin route supports direct navigation, trailing slash and refresh', async ({ page }) => {
  await mockApi(page)
  await login(page)

  const routes = [
    ['/dashboard', '控制台概览'],
    ['/projects', '项目管理中心'],
    ['/devices', '设备台账'],
    ['/orders', '工单调度中心'],
    ['/maintenance', '维修记录台账'],
    ['/parts', '备件库存管理'],
    ['/inspections', '巡检管理'],
    ['/reports', '报表与数据'],
    ['/downloads', '数据下载中心'],
    ['/users', '用户权限管理'],
    ['/toolbox', '专业工具箱'],
    ['/clients', '客户端下载中心'],
  ] as const

  for (const [path, heading] of routes) {
    for (const target of [path, `${path}/`]) {
      await page.goto(target)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await page.reload()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(page.getByText('W-Light 客户端下载')).toHaveCount(0)
    }
  }
})

test('order workflow can be assigned, accepted, logged and archived from the UI', async ({ page }) => {
  await mockOrderWorkflowApi(page)
  await login(page)

  await page.locator('a[title="工单调度中心"]').click()
  await expect(page.getByRole('heading', { name: '工单调度中心' })).toBeVisible()
  await expect(page.getByText('WO-20260608-0001')).toBeVisible()

  await page.getByRole('button', { name: '派单' }).click()
  await expect(page.getByText('选择维修负责人')).toBeVisible()
  await page.getByRole('button', { name: /维修工程师/ }).click()
  await expect(page.getByText('已派单').first()).toBeVisible()
  await expect(page.getByText('维修工程师').first()).toBeVisible()

  await page.getByRole('button', { name: '接单', exact: true }).click()
  await expect(page.getByText('处理中').first()).toBeVisible()

  await page.getByPlaceholder('记录排查步骤、更换配件、测试结果和现场情况').fill('更换保险丝并测试通过')
  await page.locator(`select:has(option[value="${PART_ID}"])`).selectOption(PART_ID)
  await page.getByPlaceholder('领用数量').fill('1')
  await page.getByRole('button', { name: /提交记录/ }).click()
  await expect(page.getByText('更换保险丝并测试通过')).toBeVisible()
  await expect(page.getByText('保险丝 × 1件')).toBeVisible()

  page.once('dialog', async (dialog) => {
    await dialog.accept('88')
  })
  await page.getByRole('button', { name: '提交验收', exact: true }).click()
  await expect(page.getByText('待验收').first()).toBeVisible()

  page.once('dialog', async (dialog) => {
    await dialog.accept('验收通过')
  })
  await page.getByRole('button', { name: '验收通过', exact: true }).click()
  await expect(page.getByText('已归档').first()).toBeVisible()
  await expect(page.getByText('Internal server error')).toHaveCount(0)
})
