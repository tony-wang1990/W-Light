import { RequestMethod, Type } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AuthController } from './modules/auth/auth.controller'
import { DevicesController } from './modules/devices/devices.controller'
import { HealthController } from './modules/health/health.module'
import { InspectionsController } from './modules/inspections/inspections.controller'
import { OrdersController } from './modules/orders/orders.controller'
import { PartsController } from './modules/parts/parts.controller'
import { ProjectsController } from './modules/projects/projects.controller'
import { ReportsController } from './modules/reports/reports.controller'
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

describe('backend API route mapping', () => {
  it('keeps auth and health routes stable', () => {
    expectRoutes(AuthController, [
      [RequestMethod.POST, 'auth/login'],
      [RequestMethod.POST, 'auth/refresh'],
      [RequestMethod.GET, 'auth/me'],
      [RequestMethod.POST, 'auth/logout'],
    ])
    expectRoutes(HealthController, [[RequestMethod.GET, 'health']])
  })

  it('keeps project and user management routes stable', () => {
    expectRoutes(ProjectsController, [
      [RequestMethod.POST, 'projects'],
      [RequestMethod.GET, 'projects'],
      [RequestMethod.GET, 'projects/:id'],
      [RequestMethod.PUT, 'projects/:id'],
    ])
    expectRoutes(UsersController, [
      [RequestMethod.POST, 'users'],
      [RequestMethod.GET, 'users'],
      [RequestMethod.GET, 'users/:id'],
      [RequestMethod.PUT, 'users/:id'],
      [RequestMethod.DELETE, 'users/:id'],
    ])
  })

  it('keeps work order routes stable', () => {
    expectRoutes(OrdersController, [
      [RequestMethod.POST, 'orders'],
      [RequestMethod.GET, 'orders'],
      [RequestMethod.GET, 'orders/summary'],
      [RequestMethod.GET, 'orders/:id'],
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
    expectRoutes(DevicesController, [
      [RequestMethod.POST, 'devices'],
      [RequestMethod.POST, 'devices/batch-import'],
      [RequestMethod.GET, 'devices'],
      [RequestMethod.GET, 'devices/scan/:qrCode'],
      [RequestMethod.GET, 'devices/:id'],
      [RequestMethod.PUT, 'devices/:id'],
      [RequestMethod.DELETE, 'devices/:id'],
    ])
    expectRoutes(PartsController, [
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
    expectRoutes(InspectionsController, [
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
    expectRoutes(ReportsController, [
      [RequestMethod.GET, 'reports/order-stats'],
      [RequestMethod.GET, 'reports/fault-analysis'],
      [RequestMethod.GET, 'reports/engineer-performance'],
      [RequestMethod.GET, 'reports/repair-cost'],
      [RequestMethod.GET, 'reports/weekly-trend'],
      [RequestMethod.GET, 'reports/device-status'],
      [RequestMethod.GET, 'reports/parts-rank'],
      [RequestMethod.GET, 'reports/operations-summary'],
      [RequestMethod.GET, 'reports/export/orders.xlsx'],
      [RequestMethod.GET, 'reports/backup.json'],
      [RequestMethod.POST, 'reports/backup/restore'],
    ])
  })
})
