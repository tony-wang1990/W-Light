import { expect, Page, Route, test } from '@playwright/test'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

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

    return response(route, {})
  })
}

test('login and key operations pages render without server errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await mockApi(page)
  await page.goto('/login')

  await page.getByLabel('服务器地址').fill('/v1')
  await page.getByLabel('账号').fill('13800000001')
  await page.getByLabel('密码').fill('WLight@2026')
  await page.getByRole('button', { name: '登录控制台' }).click()

  await expect(page.getByRole('heading', { name: '控制台概览' })).toBeVisible()

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
