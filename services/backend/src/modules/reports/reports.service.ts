import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ReportsBackupService } from './reports-backup.service'
import { ReportsExportService } from './reports-export.service'
import { OrderCategory } from '../orders/entities/order.entity'

function formatSqlDateTime(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly backupService: ReportsBackupService,
    private readonly exportService: ReportsExportService,
  ) {}

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

  exportOrdersWorkbook(projectId: string, startDate: string, endDate: string) {
    return this.exportService.exportOrdersWorkbook(projectId, startDate, endDate)
  }

  backupProjectData(projectId: string) {
    return this.backupService.backupProjectData(projectId)
  }

  restoreProjectData(projectId: string, payload: unknown, dryRun = false) {
    return this.backupService.restoreProjectData(projectId, payload, dryRun)
  }
}
