import { RequestMethod, Type } from '@nestjs/common'
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AuthController } from './modules/auth/auth.controller'
import { DevicesPublicController } from './modules/devices/devices-public.controller'
import { DevicesController } from './modules/devices/devices.controller'
import { HealthController } from './modules/health/health.module'
import { InspectionsController } from './modules/inspections/inspections.controller'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { SseController } from './modules/notifications/sse.controller'
import { OrdersController } from './modules/orders/orders.controller'
import { PartsController } from './modules/parts/parts.controller'
import { ProjectsController } from './modules/projects/projects.controller'
import { ReportsController } from './modules/reports/reports.controller'
import { UploadModule } from './modules/upload/upload.module'
import { UsersController } from './modules/users/users.controller'

type RouteExpectation = [RequestMethod, string]

function normalizePath(...parts: Array<string | string[] | undefined>): string {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part): part is string => Boolean(part))
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
}

function collectRoutes(controller: Type<unknown>) {
  const basePath = Reflect.getMetadata(PATH_METADATA, controller)
  const prototype = controller.prototype
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = prototype[name]
      const method = Reflect.getMetadata(METHOD_METADATA, handler)
      const path = Reflect.getMetadata(PATH_METADATA, handler)
      if (method === undefined || path === undefined) return undefined
      return `${RequestMethod[method]} ${normalizePath(basePath, path)}`
    })
    .filter((route): route is string => Boolean(route))
    .sort()
}

function expectRoutes(controller: Type<unknown>, routes: RouteExpectation[]) {
  const actual = collectRoutes(controller)
  for (const [method, path] of routes) {
    expect(actual).toContain(`${RequestMethod[method]} ${path}`)
  }
}

function expectExactRoutes(controller: Type<unknown>, routes: RouteExpectation[]) {
  const expected = routes
    .map(([method, path]) => `${RequestMethod[method]} ${path}`)
    .sort()
  expect(collectRoutes(controller)).toEqual(expected)
}

function moduleControllers(moduleClass: Type<unknown>) {
  return (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) || []) as Type<unknown>[]
}

describe('backend API route mapping', () => {
  it('keeps auth and health routes stable', () => {
    expectExactRoutes(AuthController, [
      [RequestMethod.POST, 'auth/login'],
      [RequestMethod.POST, 'auth/refresh'],
      [RequestMethod.GET, 'auth/me'],
      [RequestMethod.PUT, 'auth/fcm-token'],
      [RequestMethod.POST, 'auth/logout'],
    ])
    expectExactRoutes(HealthController, [
      [RequestMethod.GET, 'health'],
      [RequestMethod.GET, 'health/ready'],
    ])
  })

  it('keeps project and user management routes stable', () => {
    expectExactRoutes(ProjectsController, [
      [RequestMethod.POST, 'projects'],
      [RequestMethod.GET, 'projects'],
      [RequestMethod.GET, 'projects/overview'],
      [RequestMethod.GET, 'projects/:id'],
      [RequestMethod.PUT, 'projects/:id'],
      [RequestMethod.DELETE, 'projects/:id'],
    ])
    expectExactRoutes(UsersController, [
      [RequestMethod.POST, 'users'],
      [RequestMethod.GET, 'users'],
      [RequestMethod.GET, 'users/:id'],
      [RequestMethod.PUT, 'users/:id'],
      [RequestMethod.DELETE, 'users/:id'],
    ])
  })

  it('keeps work order routes stable', () => {
    expectExactRoutes(OrdersController, [
      [RequestMethod.POST, 'orders'],
      [RequestMethod.GET, 'orders'],
      [RequestMethod.GET, 'orders/summary'],
      [RequestMethod.GET, 'orders/overdue'],
      [RequestMethod.GET, 'orders/:id'],
      [RequestMethod.DELETE, 'orders/:id'],
      [RequestMethod.PUT, 'orders/:id/assign'],
      [RequestMethod.PUT, 'orders/:id/accept'],
      [RequestMethod.PUT, 'orders/:id/reject'],
      [RequestMethod.PUT, 'orders/:id/suspend'],
      [RequestMethod.PUT, 'orders/:id/resume'],
      [RequestMethod.PUT, 'orders/:id/submit'],
      [RequestMethod.PUT, 'orders/:id/accept-check'],
      [RequestMethod.PUT, 'orders/:id/reject-check'],
      [RequestMethod.PUT, 'orders/:id/cancel'],
      [RequestMethod.POST, 'orders/:id/repair-logs'],
      [RequestMethod.GET, 'orders/:id/repair-logs'],
    ])
  })

  it('keeps device, parts and inspection routes stable', () => {
    expectExactRoutes(DevicesController, [
      [RequestMethod.POST, 'devices'],
      [RequestMethod.POST, 'devices/batch-import'],
      [RequestMethod.GET, 'devices'],
      [RequestMethod.GET, 'devices/scan/:qrCode'],
      [RequestMethod.GET, 'devices/:id'],
      [RequestMethod.PUT, 'devices/:id'],
      [RequestMethod.DELETE, 'devices/:id'],
    ])
    expectExactRoutes(DevicesPublicController, [
      [RequestMethod.GET, 'public/devices/scan/:qrCode'],
    ])
    expectExactRoutes(PartsController, [
      [RequestMethod.POST, 'parts'],
      [RequestMethod.GET, 'parts'],
      [RequestMethod.GET, 'parts/low-stock-alerts'],
      [RequestMethod.GET, 'parts/:id'],
      [RequestMethod.PUT, 'parts/:id'],
      [RequestMethod.DELETE, 'parts/:id'],
      [RequestMethod.POST, 'parts/:id/inbound'],
      [RequestMethod.POST, 'parts/:id/outbound'],
      [RequestMethod.GET, 'parts/:id/logs'],
    ])
    expectExactRoutes(InspectionsController, [
      [RequestMethod.POST, 'inspections/plans'],
      [RequestMethod.GET, 'inspections/plans'],
      [RequestMethod.PUT, 'inspections/plans/:id'],
      [RequestMethod.GET, 'inspections/today'],
      [RequestMethod.POST, 'inspections/records'],
      [RequestMethod.GET, 'inspections/records'],
      [RequestMethod.GET, 'inspections/stats'],
    ])
  })

  it('keeps report and backup routes stable', () => {
    expectExactRoutes(ReportsController, [
      [RequestMethod.GET, 'reports/order-stats'],
      [RequestMethod.GET, 'reports/fault-analysis'],
      [RequestMethod.GET, 'reports/engineer-performance'],
      [RequestMethod.GET, 'reports/repair-cost'],
      [RequestMethod.GET, 'reports/weekly-trend'],
      [RequestMethod.GET, 'reports/device-status'],
      [RequestMethod.GET, 'reports/parts-rank'],
      [RequestMethod.GET, 'reports/operations-summary'],
      [RequestMethod.GET, 'reports/export/orders.xlsx'],
      [RequestMethod.GET, 'reports/export/devices.xlsx'],
      [RequestMethod.GET, 'reports/export/parts-inventory.xlsx'],
      [RequestMethod.GET, 'reports/export/parts-consumption.xlsx'],
      [RequestMethod.GET, 'reports/export/performance.xlsx'],
      [RequestMethod.GET, 'reports/export/fault-stats.xlsx'],
      [RequestMethod.GET, 'reports/export/financial-consumption.xlsx'],
      [RequestMethod.GET, 'reports/export/device-reliability.xlsx'],
      [RequestMethod.GET, 'reports/export/location-heatmap.xlsx'],
      [RequestMethod.GET, 'reports/export/daily-kpi.xlsx'],
      [RequestMethod.GET, 'reports/export/inspection-anomaly.xlsx'],
      [RequestMethod.GET, 'reports/export/monthly-operations.xlsx'],
      [RequestMethod.GET, 'reports/export/monthly-report.docx'],
      [RequestMethod.GET, 'reports/export/monthly-report.pdf'],
      [RequestMethod.GET, 'reports/backup.json'],
      [RequestMethod.POST, 'reports/backup/restore'],
    ])
  })

  it('keeps upload, file, notification and SSE routes stable', () => {
    const notificationRoutes = moduleControllers(NotificationsModule).flatMap(collectRoutes).sort()
    const uploadRoutes = moduleControllers(UploadModule).flatMap(collectRoutes).sort()

    expect(notificationRoutes).toEqual([
      'GET notifications',
      'GET notifications/unread-count',
      'GET sse/orders',
      'PUT notifications/:id/read',
      'PUT notifications/read-all',
    ])
    expect(uploadRoutes).toEqual([
      'GET files/projects/:projectId/uploads/:year/:fileName',
      'POST upload/image',
      'POST upload/video',
    ])
    expectRoutes(SseController, [[RequestMethod.GET, 'sse/orders']])
  })
})
