import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAuthStore } from './store/authStore'

const { PROJECT_ID, apiGetMock, apiPostMock, apiPutMock, apiDeleteMock, apiDownloadMock } = vi.hoisted(() => {
  const projectId = '11111111-1111-4111-8111-111111111111'
  return {
    PROJECT_ID: projectId,
    apiGetMock: vi.fn(async (url: string) => {
      if (url === '/projects') return [{ id: projectId, name: 'W-LightOps Sample Project' }]
      if (url.startsWith('/orders?')) return { items: [], total: 0 }
      if (url.startsWith('/orders/') && url.endsWith('/repair-logs')) return []
      if (url === '/devices') return []
      if (url === '/parts') return []
      if (url === '/parts/low-stock-alerts') return []
      if (url === '/inspections/plans') return []
      if (url.startsWith('/inspections/records')) return { items: [], total: 0 }
      if (url === '/inspections/stats') return { totalPlans: 0, todayRecords: 0 }
      if (url.startsWith('/reports/operations-summary')) {
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
      return []
    }),
    apiPostMock: vi.fn(async () => ({})),
    apiPutMock: vi.fn(async () => ({})),
    apiDeleteMock: vi.fn(async () => ({})),
    apiDownloadMock: vi.fn(async () => undefined),
  }
})

vi.mock('./api/client', () => {
  return {
    getApiBaseUrl: vi.fn(() => '/v1'),
    apiClient: {
      get: apiGetMock,
      post: apiPostMock,
      put: apiPutMock,
      delete: apiDeleteMock,
      download: apiDownloadMock,
    },
  }
})

function signIn() {
  useAuthStore.setState({
    token: 'token',
    user: {
      id: 'admin-1',
      name: 'System Admin',
      role: 'admin',
      projectIds: [PROJECT_ID],
    },
    currentProjectId: PROJECT_ID,
  })
}

describe('web app route smoke tests', () => {
  beforeEach(() => {
    apiGetMock.mockClear()
    signIn()
  })

  it('renders the login screen', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '登录控制台' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入账号或手机号')).toBeInTheDocument()
  })

  it.each([
    ['/orders', '工单调度中心'],
    ['/maintenance', '维修记录台账'],
    ['/inspections', '巡检管理'],
    ['/reports', '报表与数据'],
    ['/projects', '项目管理中心'],
    ['/toolbox', '专业工具箱'],
    ['/clients', '客户端下载中心'],
  ])('renders %s without a blank page', async (path, heading) => {
    window.history.pushState({}, '', path)
    render(<App />)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByText('W-Light')).toBeInTheDocument()
    expect(screen.getByTitle('工单调度中心')).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
  })
})
