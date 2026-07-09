import { Type } from '@nestjs/common'
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants'
import { ROLES_KEY } from './common/decorators/roles.decorator'
import { AuthController } from './modules/auth/auth.controller'
import { DevicesPublicController } from './modules/devices/devices-public.controller'
import { DevicesController } from './modules/devices/devices.controller'
import { InspectionsController } from './modules/inspections/inspections.controller'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OrdersController } from './modules/orders/orders.controller'
import { PartsController } from './modules/parts/parts.controller'
import { ProjectsController } from './modules/projects/projects.controller'
import { ReportsController } from './modules/reports/reports.controller'
import { UploadModule } from './modules/upload/upload.module'
import { UserRole } from './modules/users/entities/user.entity'
import { UsersController } from './modules/users/users.controller'

type ControllerMethod =
  | string
  | symbol

function moduleControllers(moduleClass: Type<unknown>) {
  return (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) || []) as Type<unknown>[]
}

function roleMetadata(controller: Type<unknown>, methodName: ControllerMethod) {
  const handler = controller.prototype[methodName]
  return (Reflect.getMetadata(ROLES_KEY, handler)
    || Reflect.getMetadata(ROLES_KEY, controller)
    || []) as UserRole[]
}

function expectRoles(controller: Type<unknown>, methodName: ControllerMethod, roles: UserRole[]) {
  expect(roleMetadata(controller, methodName)).toEqual(roles)
}

function expectNoRoles(controller: Type<unknown>, methodName: ControllerMethod) {
  expect(roleMetadata(controller, methodName)).toEqual([])
}

function guardNames(controller: Type<unknown>) {
  const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) || []) as Array<Type<unknown>>
  return guards.map((guard) => guard.name).sort()
}

function methodGuardNames(controller: Type<unknown>, methodName: ControllerMethod) {
  const handler = controller.prototype[methodName]
  const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) || []) as Array<Type<unknown>>
  return guards.map((guard) => guard.name).sort()
}

function expectClassGuards(controller: Type<unknown>, guards: string[]) {
  expect(guardNames(controller)).toEqual([...guards].sort())
}

function expectMethodGuards(controller: Type<unknown>, methodName: ControllerMethod, guards: string[]) {
  expect(methodGuardNames(controller, methodName)).toEqual([...guards].sort())
}

function controllerByRoutePrefix(moduleClass: Type<unknown>, routePrefix: string) {
  const found = moduleControllers(moduleClass).find((controller) => {
    const prefix = Reflect.getMetadata('path', controller)
    return prefix === routePrefix
  })

  if (!found) throw new Error(`Controller not found for route prefix: ${routePrefix}`)
  return found
}

describe('backend API permission matrix', () => {
  it('keeps authentication surfaces explicit', () => {
    expectClassGuards(AuthController, [])
    expectMethodGuards(AuthController, 'login', [])
    expectMethodGuards(AuthController, 'refresh', [])
    expectMethodGuards(AuthController, 'getMe', ['JwtAuthGuard'])
    expectMethodGuards(AuthController, 'updateFcmToken', ['JwtAuthGuard'])
    expectMethodGuards(AuthController, 'logout', ['JwtAuthGuard'])
  })

  it('guards project-scoped work order flows and restricts state transitions', () => {
    expectClassGuards(OrdersController, ['JwtAuthGuard', 'ProjectAccessGuard', 'RolesGuard'])

    for (const method of ['findAll', 'getSummary', 'getOverdue', 'findOne', 'getRepairLogs']) {
      expectNoRoles(OrdersController, method)
    }

    expectRoles(OrdersController, 'create', [UserRole.ADMIN, UserRole.ENGINEER, UserRole.INSPECTOR])
    expectRoles(OrdersController, 'assign', [UserRole.ADMIN])
    expectRoles(OrdersController, 'accept', [UserRole.ENGINEER])
    expectRoles(OrdersController, 'reject', [UserRole.ENGINEER])
    expectRoles(OrdersController, 'suspend', [UserRole.ADMIN, UserRole.ENGINEER])
    expectRoles(OrdersController, 'resume', [UserRole.ADMIN, UserRole.ENGINEER])
    expectRoles(OrdersController, 'submit', [UserRole.ENGINEER])
    expectRoles(OrdersController, 'acceptCheck', [UserRole.ADMIN])
    expectRoles(OrdersController, 'rejectCheck', [UserRole.ADMIN])
    expectRoles(OrdersController, 'cancel', [UserRole.ADMIN])
    expectRoles(OrdersController, 'addRepairLog', [UserRole.ENGINEER])
  })

  it('guards device, parts and inspection writes by role', () => {
    expectClassGuards(DevicesController, ['JwtAuthGuard', 'ProjectAccessGuard', 'RolesGuard'])
    expectClassGuards(PartsController, ['JwtAuthGuard', 'ProjectAccessGuard', 'RolesGuard'])
    expectClassGuards(InspectionsController, ['JwtAuthGuard', 'ProjectAccessGuard', 'RolesGuard'])

    for (const method of ['create', 'batchImport', 'update', 'remove']) {
      expectRoles(DevicesController, method, [UserRole.ADMIN])
    }
    for (const method of ['findAll', 'scan', 'findOne']) {
      expectNoRoles(DevicesController, method)
    }

    for (const method of ['create', 'update', 'remove', 'inbound']) {
      expectRoles(PartsController, method, [UserRole.ADMIN])
    }
    expectRoles(PartsController, 'outbound', [UserRole.ADMIN, UserRole.ENGINEER])
    for (const method of ['findAll', 'alerts', 'findOne', 'getLogs']) {
      expectNoRoles(PartsController, method)
    }

    expectRoles(InspectionsController, 'createPlan', [UserRole.ADMIN])
    expectRoles(InspectionsController, 'updatePlan', [UserRole.ADMIN])
    expectRoles(InspectionsController, 'createRecord', [UserRole.ADMIN, UserRole.ENGINEER, UserRole.INSPECTOR])
    for (const method of ['getPlans', 'getTodayPlans', 'getRecords', 'getStats']) {
      expectNoRoles(InspectionsController, method)
    }
  })

  it('guards admin management and backup operations', () => {
    expectClassGuards(ProjectsController, ['JwtAuthGuard', 'RolesGuard'])
    expectClassGuards(UsersController, ['JwtAuthGuard', 'RolesGuard'])
    expectClassGuards(ReportsController, ['JwtAuthGuard', 'ProjectAccessGuard', 'RolesGuard'])

    expectRoles(ProjectsController, 'create', [UserRole.ADMIN])
    expectRoles(ProjectsController, 'update', [UserRole.ADMIN])
    expectRoles(ProjectsController, 'remove', [UserRole.ADMIN])
    expectNoRoles(ProjectsController, 'findAll')
    expectNoRoles(ProjectsController, 'overview')
    expectNoRoles(ProjectsController, 'findOne')

    expectRoles(UsersController, 'create', [UserRole.ADMIN])
    expectRoles(UsersController, 'update', [UserRole.ADMIN])
    expectRoles(UsersController, 'remove', [UserRole.ADMIN])
    expectNoRoles(UsersController, 'findAll')
    expectNoRoles(UsersController, 'findOne')

    expectRoles(ReportsController, 'backup', [UserRole.ADMIN])
    expectRoles(ReportsController, 'restoreBackup', [UserRole.ADMIN])
    for (const method of ['weeklyTrend', 'deviceStatus', 'partsRank', 'operationsSummary']) {
      expectRoles(ReportsController, method, [
        UserRole.ADMIN,
        UserRole.ENGINEER,
        UserRole.INSPECTOR,
        UserRole.VIEWER,
      ])
    }
    for (const method of [
      'orderStats',
      'faultAnalysis',
      'engineerPerformance',
      'repairCost',
      'exportOrders',
      'exportDevices',
      'exportPartsInventory',
      'exportPartsConsumption',
      'exportPerformance',
      'exportFaultStats',
      'exportFinancialConsumption',
      'exportDeviceReliability',
      'exportLocationHeatmap',
      'exportDailyKpi',
      'exportInspectionAnomaly',
      'exportMonthlyOperations',
      'exportMonthlyPdf',
      'exportMonthlyDocx',
    ]) {
      expectRoles(ReportsController, method, [UserRole.ADMIN, UserRole.VIEWER])
    }
  })

  it('documents intentional public and authenticated utility surfaces', () => {
    expectClassGuards(DevicesPublicController, [])
    expectNoRoles(DevicesPublicController, 'scan')

    const uploadController = controllerByRoutePrefix(UploadModule, 'upload')
    const filesController = controllerByRoutePrefix(UploadModule, 'files')
    expectClassGuards(uploadController, ['JwtAuthGuard', 'ProjectAccessGuard'])
    expectClassGuards(filesController, ['JwtAuthGuard', 'ProjectAccessGuard'])

    const notificationsController = controllerByRoutePrefix(NotificationsModule, 'notifications')
    const sseController = controllerByRoutePrefix(NotificationsModule, 'sse')
    expectClassGuards(notificationsController, ['JwtAuthGuard'])
    expectClassGuards(sseController, ['JwtAuthGuard'])
  })
})
