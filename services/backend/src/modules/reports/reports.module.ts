import { BadRequestException, Body, Module, Controller, Get, Post, Query, UseGuards, Request, Res } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, In } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import * as ExcelJS from 'exceljs'
import { Device } from '../devices/entities/device.entity'
import { OrderCategory, WorkOrder } from '../orders/entities/order.entity'
import { RepairLog } from '../orders/entities/repair-log.entity'
import { SparePart } from '../parts/entities/spare-part.entity'
import { SparePartLog } from '../parts/entities/spare-part-log.entity'
import { InspectionPlan, InspectionRecord } from '../inspections/inspections.module'
import { Project } from '../projects/entities/project.entity'
import { User } from '../users/entities/user.entity'

function normalizeDateRange(startDate?: string, endDate?: string) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const end = endDate || new Date().toISOString().slice(0, 10)
  return {
    start: start.length === 10 ? `${start} 00:00:00` : start,
    end: end.length === 10 ? `${end} 23:59:59` : end,
  }
}

function formatSqlDateTime(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

type BackupRow = Record<string, any>
type BackupTables = Record<string, BackupRow[] | undefined>

interface BackupPayload {
  version?: number
  projectId?: string
  tables?: BackupTables
}

const tableLabels: Record<string, string> = {
  users: 'users',
  project: 'project',
  devices: 'devices',
  workOrders: 'workOrders',
  repairLogs: 'repairLogs',
  spareParts: 'spareParts',
  sparePartLogs: 'sparePartLogs',
  inspectionPlans: 'inspectionPlans',
  inspectionRecords: 'inspectionRecords',
}

function ensureArray(value: unknown): BackupRow[] {
  return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as BackupRow[] : []
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeJsonFields(row: BackupRow, fields: string[]) {
  const normalized = { ...row }
  fields.forEach(field => {
    normalized[field] = parseJsonArray(normalized[field])
  })
  return normalized
}

function rowsWithId(rows: BackupRow[]) {
  return rows.filter(row => typeof row.id === 'string' && row.id.trim().length > 0)
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function makeUniqueValue(base: string, usedValues: Set<string>, maxLength: number) {
  const fallback = `RESTORE-${Date.now()}`
  const normalizedBase = String(base || fallback).trim() || fallback
  const clippedBase = normalizedBase.slice(0, maxLength)
  if (!usedValues.has(clippedBase)) return clippedBase

  for (let i = 1; i <= 999; i += 1) {
    const suffix = `-R${i}`
    const candidate = `${clippedBase.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`
    if (!usedValues.has(candidate)) return candidate
  }

  const randomSuffix = `-${Math.random().toString(36).slice(2, 8)}`
  return `${clippedBase.slice(0, Math.max(1, maxLength - randomSuffix.length))}${randomSuffix}`
}

@Injectable()
class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private get isPostgres() {
    return this.ds.options.type === 'postgres'
  }

  private query<T = any>(
    sqliteSql: string,
    postgresSql: string,
    sqliteParams: unknown[] = [],
    postgresParams = sqliteParams,
  ): Promise<T[]> {
    return this.ds.query(this.isPostgres ? postgresSql : sqliteSql, this.isPostgres ? postgresParams : sqliteParams)
  }

  private dateMonthsAgo(months: number) {
    const normalizedMonths = Number.isFinite(months) ? Math.max(1, Math.min(24, Math.floor(months))) : 6
    const date = new Date()
    date.setMonth(date.getMonth() - normalizedMonths)
    return formatSqlDateTime(date)
  }

  private dateDaysAgo(days: number) {
    return formatSqlDateTime(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  }

  private unwrapBackupPayload(payload: unknown): BackupPayload {
    const candidate = (payload as { backup?: unknown })?.backup || payload
    if (!candidate || typeof candidate !== 'object') {
      throw new BadRequestException('备份文件格式不正确')
    }

    const backup = candidate as BackupPayload
    if (!backup.tables || typeof backup.tables !== 'object') {
      throw new BadRequestException('备份文件缺少 tables 数据')
    }

    return backup
  }

  private projectRows(rows: BackupRow[], projectId: string, jsonFields: string[] = []): BackupRow[] {
    return rowsWithId(rows).map(row => ({
      ...normalizeJsonFields(row, jsonFields),
      projectId,
    }))
  }

  private normalizeUsers(rows: BackupRow[], sourceProjectId: string | undefined, targetProjectId: string) {
    return rowsWithId(rows).map(row => {
      const projectIds = parseJsonArray(row.projectIds)
        .map(item => String(item))
        .filter(Boolean)
        .map(item => sourceProjectId && item === sourceProjectId ? targetProjectId : item)
      if (!projectIds.includes(targetProjectId)) projectIds.push(targetProjectId)

      return {
        ...normalizeJsonFields(row, ['skillTags']),
        projectIds,
      }
    })
  }

  private async resolveUserConflicts(
    rows: BackupRow[],
    targetProjectId: string,
    warnings: string[],
  ): Promise<{ users: BackupRow[]; userIdMap: Map<string, string> }> {
    const phones = uniqueStrings(rows.map(row => row.phone))
    const existingUsers = phones.length
      ? await this.ds.getRepository(User).find({ where: { phone: In(phones) } })
      : []
    const existingByPhone = new Map(existingUsers.map(user => [user.phone, user]))
    const users: BackupRow[] = []
    const userIdMap = new Map<string, string>()
    const addedUserIds = new Set<string>()

    for (const row of rows) {
      const phone = String(row.phone || '').trim()
      const existing = phone ? existingByPhone.get(phone) : null

      if (existing && existing.id !== row.id) {
        userIdMap.set(row.id, existing.id)
        const projectIds = parseJsonArray(existing.projectIds)
          .map(item => String(item))
          .filter(Boolean)
        if (!projectIds.includes(targetProjectId)) projectIds.push(targetProjectId)
        if (!addedUserIds.has(existing.id)) {
          users.push({ ...existing, projectIds })
          addedUserIds.add(existing.id)
        }
        warnings.push(`手机号 ${phone} 已存在，备份用户 ${row.name || row.id} 已映射到现有账号 ${existing.name || existing.id}`)
        continue
      }

      if (!addedUserIds.has(row.id)) {
        users.push(row)
        addedUserIds.add(row.id)
      }
    }

    return { users, userIdMap }
  }

  private async resolveDeviceConflicts(rows: BackupRow[], warnings: string[]): Promise<BackupRow[]> {
    const deviceRepo = this.ds.getRepository(Device)
    const existingDevices = await deviceRepo.find({ select: ['id', 'deviceNo', 'qrCode'] as any })
    const existingByNo = new Map(existingDevices.map(device => [device.deviceNo, device]))
    const existingByQr = new Map(existingDevices.map(device => [device.qrCode, device]))
    const usedDeviceNos = new Set(existingDevices.map(device => device.deviceNo))
    const usedQrCodes = new Set(existingDevices.map(device => device.qrCode))
    const seenDeviceNos = new Set<string>()
    const seenQrCodes = new Set<string>()

    return rows.map(row => {
      const originalDeviceNo = String(row.deviceNo || row.id).trim()
      const originalQrCode = String(row.qrCode || originalDeviceNo).trim()
      const deviceNoOwner = existingByNo.get(originalDeviceNo)
      const qrCodeOwner = existingByQr.get(originalQrCode)
      const hasDeviceNoConflict = seenDeviceNos.has(originalDeviceNo) || (!!deviceNoOwner && deviceNoOwner.id !== row.id)
      const hasQrCodeConflict = seenQrCodes.has(originalQrCode) || (!!qrCodeOwner && qrCodeOwner.id !== row.id)

      if (!hasDeviceNoConflict && !hasQrCodeConflict) {
        usedDeviceNos.add(originalDeviceNo)
        usedQrCodes.add(originalQrCode)
        seenDeviceNos.add(originalDeviceNo)
        seenQrCodes.add(originalQrCode)
        return { ...row, deviceNo: originalDeviceNo, qrCode: originalQrCode }
      }

      const deviceNo = makeUniqueValue(originalDeviceNo, usedDeviceNos, 50)
      usedDeviceNos.add(deviceNo)
      seenDeviceNos.add(deviceNo)
      const qrCode = makeUniqueValue(originalQrCode || deviceNo, usedQrCodes, 100)
      usedQrCodes.add(qrCode)
      seenQrCodes.add(qrCode)
      warnings.push(`设备 ${originalDeviceNo || row.id} 的编号或二维码冲突，已导入为 ${deviceNo} / ${qrCode}`)
      return { ...row, deviceNo, qrCode }
    })
  }

  private mapUserId(value: unknown, userIdMap: Map<string, string>): any {
    if (typeof value !== 'string') return value
    return userIdMap.get(value) || value
  }

  private async idsForProject(entity: any, projectId: string): Promise<string[]> {
    const rows = await this.ds.getRepository(entity).find({
      where: { projectId },
      select: ['id'] as any,
    })
    return rows.map(row => row.id).filter(Boolean)
  }

  private restoreCount(received: number, accepted: number) {
    return { received, accepted, skipped: Math.max(0, received - accepted) }
  }

  async orderStats(projectId: string, startDate: string, endDate: string) {
    return this.query(`
      SELECT
        status,
        priority,
        COUNT(*) as count,
        AVG(
          CASE
            WHEN startedAt IS NOT NULL THEN
              (julianday(COALESCE(closedAt, updatedAt)) - julianday(startedAt)) * 24
            ELSE NULL
          END
        ) as avg_hours
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
      GROUP BY status, priority
    `, `
      SELECT
        status,
        priority,
        COUNT(*) as count,
        AVG(
          CASE
            WHEN "startedAt" IS NOT NULL THEN
              EXTRACT(EPOCH FROM (COALESCE("closedAt", "updatedAt") - "startedAt")) / 3600.0
            ELSE NULL
          END
        ) as avg_hours
      FROM work_orders
      WHERE "projectId" = $1 AND "createdAt" BETWEEN $2 AND $3
      GROUP BY status, priority
    `, [projectId, startDate, endDate])
  }

  async faultAnalysis(projectId: string, months = 6) {
    const cutoff = this.dateMonthsAgo(months)
    return this.query(`
      SELECT
        strftime('%Y-%m', createdAt) as month,
        faultType,
        COUNT(*) as count
      FROM work_orders
      WHERE projectId = ?
        AND createdAt >= ?
      GROUP BY month, faultType
      ORDER BY month DESC
    `, `
      SELECT
        to_char("createdAt", 'YYYY-MM') as month,
        "faultType" as "faultType",
        COUNT(*) as count
      FROM work_orders
      WHERE "projectId" = $1
        AND "createdAt" >= $2
      GROUP BY to_char("createdAt", 'YYYY-MM'), "faultType"
      ORDER BY month DESC
    `, [projectId, cutoff])
  }

  async engineerPerformance(projectId: string, startDate: string, endDate: string) {
    return this.query(`
      SELECT
        u.name,
        u.id,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as completed,
        AVG(
          CASE
            WHEN o.assignedAt IS NOT NULL AND o.closedAt IS NOT NULL
            THEN (julianday(o.closedAt) - julianday(o.assignedAt)) * 24
            ELSE NULL
          END
        ) as avg_response_hours
      FROM work_orders o
      JOIN users u ON u.id = o.assigneeId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      GROUP BY u.id, u.name
      ORDER BY completed DESC
    `, `
      SELECT
        u.name,
        u.id,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as completed,
        AVG(
          CASE
            WHEN o."assignedAt" IS NOT NULL AND o."closedAt" IS NOT NULL
            THEN EXTRACT(EPOCH FROM (o."closedAt" - o."assignedAt")) / 3600.0
            ELSE NULL
          END
        ) as avg_response_hours
      FROM work_orders o
      JOIN users u ON u.id = o."assigneeId"
      WHERE o."projectId" = $1 AND o."createdAt" BETWEEN $2 AND $3
      GROUP BY u.id, u.name
      ORDER BY completed DESC
    `, [projectId, startDate, endDate])
  }

  async repairCostAnalysis(projectId: string, startDate: string, endDate: string) {
    return this.query(`
      SELECT
        strftime('%Y-%m', createdAt) as month,
        SUM(repairCost) as total_cost,
        COUNT(*) as order_count,
        AVG(repairCost) as avg_cost
      FROM work_orders
      WHERE projectId = ?
        AND createdAt BETWEEN ? AND ?
        AND repairCost IS NOT NULL
      GROUP BY month
      ORDER BY month
    `, `
      SELECT
        to_char("createdAt", 'YYYY-MM') as month,
        SUM("repairCost") as total_cost,
        COUNT(*) as order_count,
        AVG("repairCost") as avg_cost
      FROM work_orders
      WHERE "projectId" = $1
        AND "createdAt" BETWEEN $2 AND $3
        AND "repairCost" IS NOT NULL
      GROUP BY to_char("createdAt", 'YYYY-MM')
      ORDER BY month
    `, [projectId, startDate, endDate])
  }

  async weeklyTrend(projectId: string) {
    const cutoff = this.dateDaysAgo(7)
    return this.query(`
      SELECT
        strftime('%w', createdAt) as day_of_week,
        strftime('%Y-%m-%d', createdAt) as date_str,
        COUNT(*) as new_orders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as solved
      FROM work_orders
      WHERE projectId = ?
        AND createdAt >= ?
      GROUP BY date_str
      ORDER BY date_str ASC
    `, `
      SELECT
        EXTRACT(DOW FROM "createdAt")::int as day_of_week,
        to_char("createdAt", 'YYYY-MM-DD') as date_str,
        COUNT(*) as new_orders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as solved
      FROM work_orders
      WHERE "projectId" = $1
        AND "createdAt" >= $2
      GROUP BY to_char("createdAt", 'YYYY-MM-DD'), EXTRACT(DOW FROM "createdAt")
      ORDER BY date_str ASC
    `, [projectId, cutoff])
  }

  async deviceStatusDistribution(projectId: string) {
    return this.query(`
      SELECT status, COUNT(*) as count
      FROM devices
      WHERE projectId = ?
      GROUP BY status
    `, `
      SELECT status, COUNT(*) as count
      FROM devices
      WHERE "projectId" = $1
      GROUP BY status
    `, [projectId])
  }

  async partsConsumptionRank(projectId: string) {
    return this.query(`
      SELECT
        p.name,
        SUM(CASE WHEN l.opType = 'outbound' THEN l.quantity ELSE 0 END) as total_consumed
      FROM spare_parts p
      LEFT JOIN spare_part_logs l ON l.partId = p.id
      WHERE p.projectId = ?
      GROUP BY p.id, p.name
      ORDER BY total_consumed DESC
      LIMIT 5
    `, `
      SELECT
        p.name,
        SUM(CASE WHEN l."opType" = 'outbound' THEN l.quantity ELSE 0 END) as total_consumed
      FROM spare_parts p
      LEFT JOIN spare_part_logs l ON l."partId" = p.id
      WHERE p."projectId" = $1
      GROUP BY p.id, p.name
      ORDER BY total_consumed DESC
      LIMIT 5
    `, [projectId])
  }

  async operationsSummary(projectId: string, startDate: string, endDate: string) {
    const faultCategory = OrderCategory.FAULT
    const unclassified = '未分类'

    const [summary] = await this.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN faultType IS NOT NULL OR category = ? THEN 1 ELSE 0 END) as fault_orders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_orders,
        SUM(CASE WHEN isOvertime = 1 THEN 1 ELSE 0 END) as overtime_orders,
        AVG(
          CASE
            WHEN startedAt IS NOT NULL AND closedAt IS NOT NULL
            THEN (julianday(closedAt) - julianday(startedAt)) * 24
            ELSE NULL
          END
        ) as avg_repair_hours,
        AVG(
          CASE
            WHEN assignedAt IS NOT NULL AND startedAt IS NOT NULL
            THEN (julianday(startedAt) - julianday(assignedAt)) * 24
            ELSE NULL
          END
        ) as avg_response_hours
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
    `, `
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN "faultType" IS NOT NULL OR category = $1 THEN 1 ELSE 0 END) as fault_orders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_orders,
        SUM(CASE WHEN "isOvertime" = true THEN 1 ELSE 0 END) as overtime_orders,
        AVG(
          CASE
            WHEN "startedAt" IS NOT NULL AND "closedAt" IS NOT NULL
            THEN EXTRACT(EPOCH FROM ("closedAt" - "startedAt")) / 3600.0
            ELSE NULL
          END
        ) as avg_repair_hours,
        AVG(
          CASE
            WHEN "assignedAt" IS NOT NULL AND "startedAt" IS NOT NULL
            THEN EXTRACT(EPOCH FROM ("startedAt" - "assignedAt")) / 3600.0
            ELSE NULL
          END
        ) as avg_response_hours
      FROM work_orders
      WHERE "projectId" = $2 AND "createdAt" BETWEEN $3 AND $4
    `, [faultCategory, projectId, startDate, endDate])

    const [deviceRow] = await this.query(`
      SELECT COUNT(*) as device_count
      FROM devices
      WHERE projectId = ?
    `, `
      SELECT COUNT(*) as device_count
      FROM devices
      WHERE "projectId" = $1
    `, [projectId])

    const faultTypes = await this.query(`
      SELECT
        COALESCE(faultType, ?) as fault_type,
        COUNT(*) as count
      FROM work_orders
      WHERE projectId = ?
        AND createdAt BETWEEN ? AND ?
        AND (faultType IS NOT NULL OR category = ?)
      GROUP BY COALESCE(faultType, ?)
      ORDER BY count DESC
      LIMIT 8
    `, `
      SELECT
        COALESCE("faultType", $1) as fault_type,
        COUNT(*) as count
      FROM work_orders
      WHERE "projectId" = $2
        AND "createdAt" BETWEEN $3 AND $4
        AND ("faultType" IS NOT NULL OR category = $5)
      GROUP BY COALESCE("faultType", $1)
      ORDER BY count DESC
      LIMIT 8
    `, [unclassified, projectId, startDate, endDate, faultCategory, unclassified], [
      unclassified,
      projectId,
      startDate,
      endDate,
      faultCategory,
    ])

    const repeatFaultDevices = await this.query(`
      SELECT
        o.deviceId as device_id,
        COALESCE(d.deviceNo, '') as device_no,
        COALESCE(d.name, '') as device_name,
        COUNT(o.id) as fault_count,
        MAX(o.createdAt) as last_fault_at
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o.deviceId
      WHERE o.projectId = ?
        AND o.createdAt BETWEEN ? AND ?
        AND o.deviceId IS NOT NULL
        AND (o.faultType IS NOT NULL OR o.category = ?)
      GROUP BY o.deviceId, d.deviceNo, d.name
      HAVING COUNT(o.id) > 1
      ORDER BY fault_count DESC, last_fault_at DESC
      LIMIT 8
    `, `
      SELECT
        o."deviceId" as device_id,
        COALESCE(d."deviceNo", '') as device_no,
        COALESCE(d.name, '') as device_name,
        COUNT(o.id) as fault_count,
        MAX(o."createdAt") as last_fault_at
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o."deviceId"
      WHERE o."projectId" = $1
        AND o."createdAt" BETWEEN $2 AND $3
        AND o."deviceId" IS NOT NULL
        AND (o."faultType" IS NOT NULL OR o.category = $4)
      GROUP BY o."deviceId", d."deviceNo", d.name
      HAVING COUNT(o.id) > 1
      ORDER BY fault_count DESC, last_fault_at DESC
      LIMIT 8
    `, [projectId, startDate, endDate, faultCategory])

    const engineerPerformance = await this.query(`
      SELECT
        u.id as engineer_id,
        u.name as engineer_name,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as closed_orders,
        AVG(
          CASE
            WHEN o.startedAt IS NOT NULL AND o.closedAt IS NOT NULL
            THEN (julianday(o.closedAt) - julianday(o.startedAt)) * 24
            ELSE NULL
          END
        ) as avg_repair_hours
      FROM work_orders o
      LEFT JOIN users u ON u.id = o.assigneeId
      WHERE o.projectId = ?
        AND o.createdAt BETWEEN ? AND ?
        AND o.assigneeId IS NOT NULL
      GROUP BY u.id, u.name
      ORDER BY closed_orders DESC, total_orders DESC
      LIMIT 8
    `, `
      SELECT
        u.id as engineer_id,
        u.name as engineer_name,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as closed_orders,
        AVG(
          CASE
            WHEN o."startedAt" IS NOT NULL AND o."closedAt" IS NOT NULL
            THEN EXTRACT(EPOCH FROM (o."closedAt" - o."startedAt")) / 3600.0
            ELSE NULL
          END
        ) as avg_repair_hours
      FROM work_orders o
      LEFT JOIN users u ON u.id = o."assigneeId"
      WHERE o."projectId" = $1
        AND o."createdAt" BETWEEN $2 AND $3
        AND o."assigneeId" IS NOT NULL
      GROUP BY u.id, u.name
      ORDER BY closed_orders DESC, total_orders DESC
      LIMIT 8
    `, [projectId, startDate, endDate])

    const partsConsumption = await this.query(`
      SELECT
        p.id as part_id,
        p.name as part_name,
        p.unit as unit,
        SUM(CASE WHEN l.opType = 'outbound' THEN l.quantity ELSE 0 END) as consumed_quantity,
        COUNT(DISTINCT l.orderId) as order_count
      FROM spare_parts p
      JOIN spare_part_logs l ON l.partId = p.id
      WHERE p.projectId = ?
        AND l.createdAt BETWEEN ? AND ?
        AND l.opType = 'outbound'
      GROUP BY p.id, p.name, p.unit
      ORDER BY consumed_quantity DESC
      LIMIT 8
    `, `
      SELECT
        p.id as part_id,
        p.name as part_name,
        p.unit as unit,
        SUM(CASE WHEN l."opType" = 'outbound' THEN l.quantity ELSE 0 END) as consumed_quantity,
        COUNT(DISTINCT l."orderId") as order_count
      FROM spare_parts p
      JOIN spare_part_logs l ON l."partId" = p.id
      WHERE p."projectId" = $1
        AND l."createdAt" BETWEEN $2 AND $3
        AND l."opType" = 'outbound'
      GROUP BY p.id, p.name, p.unit
      ORDER BY consumed_quantity DESC
      LIMIT 8
    `, [projectId, startDate, endDate])

    const totalOrders = Number(summary?.total_orders) || 0
    const faultOrders = Number(summary?.fault_orders) || 0
    const deviceCount = Number(deviceRow?.device_count) || 0

    return {
      range: { startDate, endDate },
      overview: {
        totalOrders,
        faultOrders,
        closedOrders: Number(summary?.closed_orders) || 0,
        overtimeOrders: Number(summary?.overtime_orders) || 0,
        deviceCount,
        faultRateByOrders: totalOrders ? Math.round((faultOrders / totalOrders) * 1000) / 10 : 0,
        faultRateByDevices: deviceCount ? Math.round((faultOrders / deviceCount) * 1000) / 10 : 0,
        avgRepairHours: Math.round((Number(summary?.avg_repair_hours) || 0) * 10) / 10,
        avgResponseHours: Math.round((Number(summary?.avg_response_hours) || 0) * 10) / 10,
      },
      faultTypes,
      repeatFaultDevices,
      engineerPerformance,
      partsConsumption,
    }
  }

  async exportOrdersWorkbook(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT
        o.orderNo,
        o.category,
        o.priority,
        o.status,
        COALESCE(o.faultType, '') as faultType,
        o.faultDesc,
        COALESCE(d.deviceNo, '') as deviceNo,
        COALESCE(d.name, '') as deviceName,
        COALESCE(d.location, o.locationDesc, '') as location,
        COALESCE(reporter.name, '') as reporterName,
        COALESCE(assignee.name, '') as assigneeName,
        o.createdAt,
        o.assignedAt,
        o.startedAt,
        o.submittedAt,
        o.closedAt,
        o.isOvertime,
        o.repairCost
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o.deviceId
      LEFT JOIN users reporter ON reporter.id = o.reporterId
      LEFT JOIN users assignee ON assignee.id = o.assigneeId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      ORDER BY o.createdAt DESC
    `, `
      SELECT
        o."orderNo" as "orderNo",
        o.category,
        o.priority,
        o.status,
        COALESCE(o."faultType", '') as "faultType",
        o."faultDesc" as "faultDesc",
        COALESCE(d."deviceNo", '') as "deviceNo",
        COALESCE(d.name, '') as "deviceName",
        COALESCE(d.location, o."locationDesc", '') as location,
        COALESCE(reporter.name, '') as "reporterName",
        COALESCE(assignee.name, '') as "assigneeName",
        o."createdAt" as "createdAt",
        o."assignedAt" as "assignedAt",
        o."startedAt" as "startedAt",
        o."submittedAt" as "submittedAt",
        o."closedAt" as "closedAt",
        o."isOvertime" as "isOvertime",
        o."repairCost" as "repairCost"
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o."deviceId"
      LEFT JOIN users reporter ON reporter.id = o."reporterId"
      LEFT JOIN users assignee ON assignee.id = o."assigneeId"
      WHERE o."projectId" = $1 AND o."createdAt" BETWEEN $2 AND $3
      ORDER BY o."createdAt" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'LightOps'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('工单台账')
    sheet.columns = [
      { header: '工单编号', key: 'orderNo', width: 18 },
      { header: '类别', key: 'category', width: 14 },
      { header: '优先级', key: 'priority', width: 10 },
      { header: '状态', key: 'status', width: 12 },
      { header: '故障类型', key: 'faultType', width: 16 },
      { header: '故障描述', key: 'faultDesc', width: 36 },
      { header: '设备编号', key: 'deviceNo', width: 18 },
      { header: '设备名称', key: 'deviceName', width: 22 },
      { header: '位置', key: 'location', width: 24 },
      { header: '报修人', key: 'reporterName', width: 14 },
      { header: '维修人', key: 'assigneeName', width: 14 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '派单时间', key: 'assignedAt', width: 20 },
      { header: '开始维修', key: 'startedAt', width: 20 },
      { header: '提交验收', key: 'submittedAt', width: 20 },
      { header: '归档时间', key: 'closedAt', width: 20 },
      { header: '是否超时', key: 'isOvertime', width: 10 },
      { header: '维修费用', key: 'repairCost', width: 12 },
    ]
    rows.forEach(row => sheet.addRow({
      ...row,
      isOvertime: row.isOvertime ? '是' : '否',
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async backupProjectData(projectId: string) {
    const userRepo = this.ds.getRepository(User)
    const deviceRepo = this.ds.getRepository(Device)
    const orderRepo = this.ds.getRepository(WorkOrder)
    const repairLogRepo = this.ds.getRepository(RepairLog)
    const partRepo = this.ds.getRepository(SparePart)
    const partLogRepo = this.ds.getRepository(SparePartLog)
    const inspectionPlanRepo = this.ds.getRepository(InspectionPlan)
    const inspectionRecordRepo = this.ds.getRepository(InspectionRecord)

    const [
      project,
      users,
      devices,
      orders,
      parts,
      inspectionPlans,
    ] = await Promise.all([
      this.ds.getRepository(Project).findOne({ where: { id: projectId } }),
      userRepo.find().then(items => items.filter(user => parseJsonArray(user.projectIds).includes(projectId))),
      deviceRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      orderRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      partRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      inspectionPlanRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
    ])

    const orderIds = orders.map(order => order.id).filter(Boolean)
    const partIds = parts.map(part => part.id).filter(Boolean)
    const planIds = inspectionPlans.map(plan => plan.id).filter(Boolean)

    const [
      repairLogs,
      partLogs,
      inspectionRecords,
    ] = await Promise.all([
      orderIds.length
        ? repairLogRepo.find({ where: { orderId: In(orderIds) }, order: { loggedAt: 'DESC' } as any })
        : Promise.resolve([]),
      partIds.length
        ? partLogRepo.find({ where: { partId: In(partIds) }, order: { createdAt: 'DESC' } as any })
        : Promise.resolve([]),
      planIds.length
        ? inspectionRecordRepo.find({ where: { planId: In(planIds) }, order: { inspectedAt: 'DESC' } as any })
        : Promise.resolve([]),
    ])

    return {
      version: 1,
      projectId,
      exportedAt: new Date().toISOString(),
      tables: {
        project: project ? [project] : [],
        users,
        devices,
        workOrders: orders,
        repairLogs,
        spareParts: parts,
        sparePartLogs: partLogs,
        inspectionPlans,
        inspectionRecords,
      },
    }
  }

  async restoreProjectData(projectId: string, payload: unknown, dryRun = false) {
    const backup = this.unwrapBackupPayload(payload)
    const tables = backup.tables || {}
    const warnings: string[] = []

    const normalizedUsers = this.normalizeUsers(ensureArray(tables.users), backup.projectId, projectId)
    const { users, userIdMap } = await this.resolveUserConflicts(normalizedUsers, projectId, warnings)
    const project = ensureArray(tables.project)
      .slice(0, 1)
      .map(row => ({ ...row, id: projectId }))

    const devices = await this.resolveDeviceConflicts(this.projectRows(ensureArray(tables.devices), projectId), warnings)
    const workOrders: BackupRow[] = this.projectRows(ensureArray(tables.workOrders), projectId, ['mediaUrls'])
      .map(row => ({
        ...row,
        reporterId: this.mapUserId(row.reporterId, userIdMap),
        assigneeId: this.mapUserId(row.assigneeId, userIdMap),
      }))
    const spareParts = this.projectRows(ensureArray(tables.spareParts), projectId)
    const inspectionPlans: BackupRow[] = this.projectRows(ensureArray(tables.inspectionPlans), projectId, ['deviceIds'])
      .map(row => ({
        ...row,
        assigneeId: this.mapUserId(row.assigneeId, userIdMap),
      }))

    const currentOrderIds = await this.idsForProject(WorkOrder, projectId)
    const currentPartIds = await this.idsForProject(SparePart, projectId)
    const currentPlanIds = await this.idsForProject(InspectionPlan, projectId)
    const orderIds = new Set([...currentOrderIds, ...workOrders.map(row => row.id)])
    const partIds = new Set([...currentPartIds, ...spareParts.map(row => row.id)])
    const planIds = new Set([...currentPlanIds, ...inspectionPlans.map(row => row.id)])

    const rawRepairLogs = rowsWithId(ensureArray(tables.repairLogs))
    const repairLogs = rawRepairLogs
      .filter(row => orderIds.has(row.orderId))
      .map(row => normalizeJsonFields({
        ...row,
        engineerId: this.mapUserId(row.engineerId, userIdMap),
      }, ['photoUrls', 'partUsages']))

    const rawPartLogs = rowsWithId(ensureArray(tables.sparePartLogs))
    const sparePartLogs: BackupRow[] = rawPartLogs
      .filter(row => partIds.has(row.partId))
      .map(row => ({
        ...row,
        operatorId: this.mapUserId(row.operatorId, userIdMap),
      }))

    const rawInspectionRecords = rowsWithId(ensureArray(tables.inspectionRecords))
    const inspectionRecords = rawInspectionRecords
      .filter(row => planIds.has(row.planId))
      .map(row => normalizeJsonFields({
        ...row,
        inspectorId: this.mapUserId(row.inspectorId, userIdMap),
      }, ['photoUrls']))

    if (rawRepairLogs.length !== repairLogs.length) {
      warnings.push(`跳过 ${rawRepairLogs.length - repairLogs.length} 条未匹配当前项目工单的维修记录`)
    }
    if (rawPartLogs.length !== sparePartLogs.length) {
      warnings.push(`跳过 ${rawPartLogs.length - sparePartLogs.length} 条未匹配当前项目备件的库存流水`)
    }
    if (rawInspectionRecords.length !== inspectionRecords.length) {
      warnings.push(`跳过 ${rawInspectionRecords.length - inspectionRecords.length} 条未匹配当前项目巡检计划的巡检记录`)
    }

    const result = {
      dryRun,
      version: backup.version || 1,
      sourceProjectId: backup.projectId,
      targetProjectId: projectId,
      restoredAt: dryRun ? undefined : new Date().toISOString(),
      warnings,
      tables: {
        [tableLabels.users]: this.restoreCount(ensureArray(tables.users).length, users.length),
        [tableLabels.project]: this.restoreCount(ensureArray(tables.project).length, project.length),
        [tableLabels.devices]: this.restoreCount(ensureArray(tables.devices).length, devices.length),
        [tableLabels.workOrders]: this.restoreCount(ensureArray(tables.workOrders).length, workOrders.length),
        [tableLabels.repairLogs]: this.restoreCount(rawRepairLogs.length, repairLogs.length),
        [tableLabels.spareParts]: this.restoreCount(ensureArray(tables.spareParts).length, spareParts.length),
        [tableLabels.sparePartLogs]: this.restoreCount(rawPartLogs.length, sparePartLogs.length),
        [tableLabels.inspectionPlans]: this.restoreCount(ensureArray(tables.inspectionPlans).length, inspectionPlans.length),
        [tableLabels.inspectionRecords]: this.restoreCount(rawInspectionRecords.length, inspectionRecords.length),
      },
    }

    if (dryRun) return result

    await this.ds.transaction(async manager => {
      if (users.length) await manager.getRepository(User).save(users, { chunk: 50 })
      if (project.length) await manager.getRepository(Project).save(project, { chunk: 50 })
      if (devices.length) await manager.getRepository(Device).save(devices, { chunk: 50 })
      if (spareParts.length) await manager.getRepository(SparePart).save(spareParts, { chunk: 50 })
      if (inspectionPlans.length) await manager.getRepository(InspectionPlan).save(inspectionPlans, { chunk: 50 })
      if (workOrders.length) await manager.getRepository(WorkOrder).save(workOrders, { chunk: 50 })
      if (repairLogs.length) await manager.getRepository(RepairLog).save(repairLogs, { chunk: 50 })
      if (sparePartLogs.length) await manager.getRepository(SparePartLog).save(sparePartLogs, { chunk: 50 })
      if (inspectionRecords.length) await manager.getRepository(InspectionRecord).save(inspectionRecords, { chunk: 50 })
    })

    return result
  }
}

@ApiTags('报表统计')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('order-stats')
  orderStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.orderStats(req.headers['x-project-id'], range.start, range.end)
  }

  @Get('fault-analysis')
  faultAnalysis(@Request() req, @Query('months') months?: string) {
    return this.svc.faultAnalysis(req.headers['x-project-id'], Number(months || 6))
  }

  @Get('engineer-performance')
  engineerPerformance(@Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.engineerPerformance(req.headers['x-project-id'], range.start, range.end)
  }

  @Get('repair-cost')
  repairCost(@Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.repairCostAnalysis(req.headers['x-project-id'], range.start, range.end)
  }

  @Get('weekly-trend')
  weeklyTrend(@Request() req) {
    return this.svc.weeklyTrend(req.headers['x-project-id'])
  }

  @Get('device-status')
  deviceStatus(@Request() req) {
    return this.svc.deviceStatusDistribution(req.headers['x-project-id'])
  }

  @Get('parts-rank')
  partsRank(@Request() req) {
    return this.svc.partsConsumptionRank(req.headers['x-project-id'])
  }

  @Get('operations-summary')
  operationsSummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.operationsSummary(req.headers['x-project-id'], range.start, range.end)
  }

  @Get('export/orders.xlsx')
  async exportOrders(
    @Request() req,
    @Res() res,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = normalizeDateRange(startDate, endDate)
    const buffer = await this.svc.exportOrdersWorkbook(req.headers['x-project-id'], range.start, range.end)
    const filename = `lightops-orders-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get('backup.json')
  async backup(@Request() req, @Res() res) {
    const data = await this.svc.backupProjectData(req.headers['x-project-id'])
    const filename = `lightops-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(data, null, 2))
  }

  @Post('backup/restore')
  restoreBackup(
    @Request() req,
    @Body() body: unknown,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.svc.restoreProjectData(
      req.headers['x-project-id'],
      body,
      dryRun === 'true' || dryRun === '1',
    )
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
