import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Devices from './pages/Devices/Devices'
import Inspections from './pages/Inspections/Inspections'
import Maintenance from './pages/Maintenance/Maintenance'
import Orders from './pages/Orders/Orders'
import OrderDetailDrawer from './pages/Orders/components/OrderDetailDrawer'
import Reports from './pages/Reports/Reports'
import { useAuthStore } from './store/authStore'

const { PROJECT_ID, apiGetMock, apiDownloadMock } = vi.hoisted(() => {
  const projectId = '11111111-1111-4111-8111-111111111111'
  const orders = [
    {
      id: 'order-pending',
      orderNo: 'WO-PENDING',
      status: 'pending',
      priority: 'P2',
      faultDesc: '待派单工单',
      assigneeId: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'order-assigned-other',
      orderNo: 'WO-ASSIGNED-OTHER',
      status: 'assigned',
      priority: 'P2',
      faultDesc: '别人负责的已派单工单',
      assigneeId: 'engineer-other',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'order-assigned-self',
      orderNo: 'WO-ASSIGNED-SELF',
      status: 'assigned',
      priority: 'P2',
      faultDesc: '自己负责的已派单工单',
      assigneeId: 'engineer-self',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ]

  return {
    PROJECT_ID: projectId,
    apiGetMock: vi.fn(async (url: string) => {
      if (url.startsWith('/orders?')) return { items: orders, total: orders.length }
      if (url.endsWith('/repair-logs')) return []
      if (url === '/parts') return []
      if (url === '/users?pageSize=200') return []
      if (url === '/inspections/today') return []
      if (url === '/inspections/plans') return []
      if (url.startsWith('/inspections/records')) return { items: [] }
      if (url.startsWith('/devices')) {
        return [{
          id: 'device-1',
          deviceNo: 'DEV-001',
          name: '主舞台摇头灯',
          category: '灯具',
          location: '主舞台',
          status: 'normal',
          healthScore: 96,
          lastMaintainAt: null,
        }]
      }
      if (url.startsWith('/reports/operations-summary')) {
        return {
          overview: {
            totalOrders: 0,
            faultOrders: 0,
            closedOrders: 0,
            activeOrders: 0,
            overtimeOrders: 0,
            totalRepairCost: 0,
            deviceCount: 0,
            closureRate: 100,
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
    apiDownloadMock: vi.fn(async () => undefined),
  }
})

vi.mock('./api/client', () => ({
  getApiBaseUrl: vi.fn(() => '/v1'),
  apiClient: {
    get: apiGetMock,
    post: vi.fn(async () => ({})),
    put: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    download: apiDownloadMock,
  },
}))

function signIn(role: 'admin' | 'engineer' | 'inspector' | 'viewer', id: string = role) {
  useAuthStore.setState({
    token: 'token',
    user: {
      id,
      name: role,
      role,
      projectIds: [PROJECT_ID],
    },
    currentProjectId: PROJECT_ID,
  })
}

describe('cross-client interaction permissions', () => {
  beforeEach(() => {
    signIn('admin')
  })

  it('only shows actionable work-order buttons for admins or the current assignee', async () => {
    signIn('engineer', 'engineer-self')

    render(<Orders />)

    expect(await screen.findByText('WO-PENDING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '派单' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '接单/拒单' })).toHaveLength(1)
  })

  it('does not show accept/reject to engineers who are not assigned to the order', async () => {
    signIn('engineer', 'engineer-self')

    render(
      <OrderDetailDrawer
        order={{
          id: 'order-assigned-other',
          orderNo: 'WO-ASSIGNED-OTHER',
          status: 'assigned',
          priority: 'P2',
          faultDesc: '别人负责的已派单工单',
          assigneeId: 'engineer-other',
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(await screen.findByText('工单操作')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /接单/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '拒单' })).not.toBeInTheDocument()
  })

  it('keeps device edit/delete controls admin-only', async () => {
    signIn('engineer', 'engineer-self')

    render(<Devices />)

    expect(await screen.findByText('DEV-001')).toBeInTheDocument()
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excel导入/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新增设备/ })).not.toBeInTheDocument()
  })

  it('keeps backup and restore controls admin-only on reports', async () => {
    signIn('viewer')

    render(<Reports />)

    expect(await screen.findByRole('heading', { name: '报表与数据' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /下载项目备份/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /恢复备份/ })).not.toBeInTheDocument()
  })

  it('hides maintenance export from roles that cannot call report export APIs', async () => {
    signIn('engineer', 'engineer-self')

    render(<Maintenance />)

    expect(await screen.findByRole('heading', { name: '维修记录台账' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /导出台账 Excel/ })).not.toBeInTheDocument()
  })

  it('loads only assigned due inspection plans for non-admin users', async () => {
    signIn('inspector', 'inspector-self')

    render(<Inspections />)

    expect(await screen.findByRole('heading', { name: '巡检管理' })).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/inspections/today')
    expect(apiGetMock).not.toHaveBeenCalledWith('/inspections/plans')
  })
})
