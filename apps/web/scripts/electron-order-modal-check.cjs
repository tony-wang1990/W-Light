const { _electron } = require('@playwright/test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const projectId = '11111111-1111-4111-8111-111111111111'
const executablePath = path.resolve(
  __dirname,
  '../../desktop/dist/win-unpacked/W-Light.exe',
)

function json(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  })
}

async function main() {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Windows client not found: ${executablePath}`)
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlight-electron-e2e-'))
  const app = await _electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDir}`],
  })

  try {
    const page = await app.firstWindow()
    page.on('console', message => {
      if (message.type() === 'error') console.error(`[renderer] ${message.text()}`)
    })
    await page.route('**/v1/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      const apiPath = url.pathname.replace(/^\/v1/, '') || '/'
      console.log(`[api] ${request.method()} ${url.href}`)

      if (request.method() === 'POST' && apiPath === '/auth/login') {
        return json(route, {
          accessToken: 'electron-e2e-token',
          user: {
            id: 'admin-1',
            name: '系统管理员',
            phone: '13800000001',
            role: 'admin',
            projectIds: [projectId],
          },
        }, 201)
      }
      if (request.method() === 'GET' && apiPath === '/auth/me') {
        return json(route, {
          id: 'admin-1',
          name: '系统管理员',
          phone: '13800000001',
          role: 'admin',
          projectIds: [projectId],
        })
      }
      if (request.method() === 'GET' && apiPath === '/projects') {
        return json(route, [{ id: projectId, name: '客户端测试项目' }])
      }
      if (request.method() === 'GET' && apiPath === '/projects/overview') {
        return json(route, [])
      }
      if (request.method() === 'GET' && apiPath === '/reports/operations-summary') {
        return json(route, {
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
        })
      }
      if (request.method() === 'GET' && [
        '/reports/weekly-trend',
        '/reports/device-status',
        '/reports/parts-rank',
        '/orders/overdue',
        '/parts/low-stock-alerts',
      ].includes(apiPath)) {
        return json(route, [])
      }
      if (request.method() === 'GET' && apiPath === '/inspections/stats') {
        return json(route, { totalPlans: 0, todayRecords: 0 })
      }
      if (request.method() === 'GET' && apiPath === '/inspections/plans') {
        return json(route, [])
      }
      if (request.method() === 'GET' && apiPath === '/inspections/records') {
        return json(route, { items: [], total: 0 })
      }
      if (request.method() === 'GET' && apiPath === '/users') {
        return json(route, [])
      }
      if (request.method() === 'GET' && apiPath === '/orders') {
        return json(route, { items: [], total: 0, page: 1, pageSize: 200, totalPages: 0 })
      }
      if (request.method() === 'GET' && apiPath === '/devices') {
        return json(route, { items: [], total: 0 })
      }
      if (request.method() === 'GET' && apiPath === '/parts') {
        return json(route, { items: [], total: 0 })
      }
      if (request.method() === 'POST' && apiPath === '/orders') {
        return json(route, {
          id: 'order-1',
          orderNo: 'WO-ELECTRON-0001',
          status: 'pending',
          ...request.postDataJSON(),
        }, 201)
      }
      if (request.method() === 'GET' && apiPath.includes('/sse/orders')) {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
      }
      return json(route, {})
    })
    await page.route('https://mock.wlight.test/downloads/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname.endsWith('.json')) {
        const isAndroid = url.pathname.includes('android')
        return json(route, {
          file: isAndroid ? 'w-light-latest.apk' : 'W-Light-Setup-latest.exe',
          version: '0.9.0-build.electron-test',
          commit: 'electron-test',
          sizeBytes: 1024,
          sha256: 'a'.repeat(64),
          publishedAt: new Date().toISOString(),
        })
      }
      return route.fulfill({ status: 200, body: '' })
    })

    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input')
    await inputs.nth(0).fill('https://mock.wlight.test/v1')
    await inputs.nth(1).fill('13800000001')
    await inputs.nth(2).fill('WLight@2026')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/#\/dashboard(?:\/)?$/)

    const routes = [
      '/dashboard',
      '/projects',
      '/devices',
      '/orders',
      '/maintenance',
      '/parts',
      '/inspections',
      '/reports',
      '/downloads',
      '/users',
      '/toolbox',
      '/clients',
    ]
    for (const routePath of routes) {
      await page.locator(`a[href="#${routePath}"]`).click()
      await page.waitForURL(new RegExp(`#${routePath.replace('/', '\\/')}(?:\\/)?$`))
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      const bodyText = await page.locator('body').innerText()
      if (bodyText.includes('Internal server error') || bodyText.includes('W-Light 客户端下载')) {
        throw new Error(`Electron route failed after refresh: ${routePath}`)
      }
    }

    const ordersLink = page.locator('a').filter({ hasText: /工单调度/ })
    if (await ordersLink.count() === 0) {
      const links = await page.locator('a').evaluateAll(items => items.map(item => ({
        text: item.textContent,
        href: item.getAttribute('href'),
      })))
      throw new Error(`Orders link missing. URL=${page.url()} links=${JSON.stringify(links)} body=${(await page.locator('body').innerText()).slice(0, 2000)}`)
    }
    await ordersLink.click()
    await page.waitForURL(/#\/orders(?:\/)?$/)

    const createButton = page.getByRole('button', { name: /新增报修/ })
    if (await createButton.count() === 0) {
      throw new Error(`Create order button missing. Body: ${(await page.locator('body').innerText()).slice(0, 2000)}`)
    }
    await createButton.click()
    const textarea = page.locator('textarea[name="faultDesc"]')
    await textarea.click()
    await textarea.fill('Windows 客户端输入测试')

    const actualValue = await textarea.inputValue()
    const focusedName = await page.evaluate(() => document.activeElement?.getAttribute('name'))
    if (actualValue !== 'Windows 客户端输入测试' || focusedName !== 'faultDesc') {
      throw new Error(`Modal input failed: value=${actualValue}, focus=${focusedName}`)
    }

    await page.getByRole('button', { name: /确定派发/ }).click()
    console.log(JSON.stringify({
      passed: true,
      executablePath,
      modalValue: actualValue,
      focusedName,
    }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
