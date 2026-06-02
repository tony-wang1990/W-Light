import { BadRequestException, Body, Module, Controller, Get, Post, Query, UseGuards, Request, Res } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import * as ExcelJS from 'exceljs'
import { Device } from '../devices/entities/device.entity'
import { WorkOrder } from '../orders/entities/order.entity'
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

@Injectable()
class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

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

  /**
   * 工单状态统计 — SQLite 兼容版本
   * SQLite 不支持 EXTRACT(EPOCH) 和 to_char，使用 strftime 和 julianday
   */
  async orderStats(projectId: string, startDate: string, endDate: string) {
    const rows = await this.ds.query(`
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
    `, [projectId, startDate, endDate])
    return rows
  }

  /**
   * 故障类型趋势分析 — SQLite 兼容版本
   * 使用 strftime 代替 to_char
   */
  async faultAnalysis(projectId: string, months = 6) {
    // SQLite: datetime('now', '-N months') 计算 N 个月前
    return this.ds.query(`
      SELECT 
        strftime('%Y-%m', createdAt) as month,
        faultType, 
        COUNT(*) as count
      FROM work_orders
      WHERE projectId = ? 
        AND createdAt > datetime('now', '-${months} months')
      GROUP BY month, faultType
      ORDER BY month DESC
    `, [projectId])
  }

  /**
   * 工程师绩效统计 — SQLite 兼容版本
   */
  async engineerPerformance(projectId: string, startDate: string, endDate: string) {
    return this.ds.query(`
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
    `, [projectId, startDate, endDate])
  }

  /**
   * 维修费用分析 — SQLite 兼容版本
   */
  async repairCostAnalysis(projectId: string, startDate: string, endDate: string) {
    return this.ds.query(`
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
    `, [projectId, startDate, endDate])
  }

  /**
   * 最近7天工单趋势（Dashboard 图表用）
   */
  async weeklyTrend(projectId: string) {
    const rows = await this.ds.query(`
      SELECT 
        strftime('%w', createdAt) as day_of_week,
        strftime('%Y-%m-%d', createdAt) as date_str,
        COUNT(*) as new_orders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as solved
      FROM work_orders
      WHERE projectId = ? 
        AND createdAt >= datetime('now', '-7 days')
      GROUP BY date_str
      ORDER BY date_str ASC
    `, [projectId])
    return rows
  }

  /**
   * 设备状态分布（Dashboard 饼图用）
   */
  async deviceStatusDistribution(projectId: string) {
    return this.ds.query(`
      SELECT status, COUNT(*) as count
      FROM devices
      WHERE projectId = ?
      GROUP BY status
    `, [projectId])
  }

  /**
   * 备件消耗排行（Dashboard 柱状图用）
   */
  async partsConsumptionRank(projectId: string) {
    return this.ds.query(`
      SELECT 
        p.name,
        SUM(CASE WHEN l.opType = 'outbound' THEN l.quantity ELSE 0 END) as total_consumed
      FROM spare_parts p
      LEFT JOIN spare_part_logs l ON l.partId = p.id
      WHERE p.projectId = ?
      GROUP BY p.id, p.name
      ORDER BY total_consumed DESC
      LIMIT 5
    `, [projectId])
  }

  /**
   * 运维综合报表：故障率、维修时长、重复故障、人员绩效、备件消耗
   */
  async operationsSummary(projectId: string, startDate: string, endDate: string) {
    const [summary] = await this.ds.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN faultType IS NOT NULL OR category = '故障维修' THEN 1 ELSE 0 END) as fault_orders,
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
    `, [projectId, startDate, endDate])

    const [deviceRow] = await this.ds.query(`
      SELECT COUNT(*) as device_count
      FROM devices
      WHERE projectId = ?
    `, [projectId])

    const faultTypes = await this.ds.query(`
      SELECT
        COALESCE(faultType, '未分类') as fault_type,
        COUNT(*) as count
      FROM work_orders
      WHERE projectId = ?
        AND createdAt BETWEEN ? AND ?
        AND (faultType IS NOT NULL OR category = '故障维修')
      GROUP BY COALESCE(faultType, '未分类')
      ORDER BY count DESC
      LIMIT 8
    `, [projectId, startDate, endDate])

    const repeatFaultDevices = await this.ds.query(`
      SELECT
        o.deviceId as device_id,
        COALESCE(d.deviceNo, '') as device_no,
        COALESCE(d.name, '未知设备') as device_name,
        COUNT(o.id) as fault_count,
        MAX(o.createdAt) as last_fault_at
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o.deviceId
      WHERE o.projectId = ?
        AND o.createdAt BETWEEN ? AND ?
        AND o.deviceId IS NOT NULL
        AND (o.faultType IS NOT NULL OR o.category = '故障维修')
      GROUP BY o.deviceId, d.deviceNo, d.name
      HAVING COUNT(o.id) > 1
      ORDER BY fault_count DESC, last_fault_at DESC
      LIMIT 8
    `, [projectId, startDate, endDate])

    const engineerPerformance = await this.ds.query(`
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
    `, [projectId, startDate, endDate])

    const partsConsumption = await this.ds.query(`
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
    const rows = await this.ds.query(`
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
    const [
      project,
      users,
      devices,
      orders,
      repairLogs,
      parts,
      partLogs,
      inspectionPlans,
      inspectionRecords,
    ] = await Promise.all([
      this.ds.getRepository(Project).findOne({ where: { id: projectId } }),
      userRepo.find().then(items => items.filter(user => parseJsonArray(user.projectIds).includes(projectId))),
      this.ds.query('SELECT * FROM devices WHERE projectId = ? ORDER BY createdAt DESC', [projectId]),
      this.ds.query('SELECT * FROM work_orders WHERE projectId = ? ORDER BY createdAt DESC', [projectId]),
      this.ds.query(`
        SELECT l.*
        FROM repair_logs l
        JOIN work_orders o ON o.id = l.orderId
        WHERE o.projectId = ?
        ORDER BY l.loggedAt DESC
      `, [projectId]),
      this.ds.query('SELECT * FROM spare_parts WHERE projectId = ? ORDER BY createdAt DESC', [projectId]),
      this.ds.query(`
        SELECT l.*
        FROM spare_part_logs l
        JOIN spare_parts p ON p.id = l.partId
        WHERE p.projectId = ?
        ORDER BY l.createdAt DESC
      `, [projectId]),
      this.ds.query('SELECT * FROM inspection_plans WHERE projectId = ? ORDER BY createdAt DESC', [projectId]),
      this.ds.query('SELECT * FROM inspection_records WHERE projectId = ? ORDER BY createdAt DESC', [projectId]),
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

    const users = this.normalizeUsers(ensureArray(tables.users), backup.projectId, projectId)
    const project = ensureArray(tables.project)
      .slice(0, 1)
      .map(row => ({ ...row, id: projectId }))

    const devices = this.projectRows(ensureArray(tables.devices), projectId)
    const workOrders = this.projectRows(ensureArray(tables.workOrders), projectId, ['mediaUrls'])
    const spareParts = this.projectRows(ensureArray(tables.spareParts), projectId)
    const inspectionPlans = this.projectRows(ensureArray(tables.inspectionPlans), projectId, ['deviceIds'])

    const currentOrderIds = await this.idsForProject(WorkOrder, projectId)
    const currentPartIds = await this.idsForProject(SparePart, projectId)
    const currentPlanIds = await this.idsForProject(InspectionPlan, projectId)
    const orderIds = new Set([...currentOrderIds, ...workOrders.map(row => row.id)])
    const partIds = new Set([...currentPartIds, ...spareParts.map(row => row.id)])
    const planIds = new Set([...currentPlanIds, ...inspectionPlans.map(row => row.id)])

    const rawRepairLogs = rowsWithId(ensureArray(tables.repairLogs))
    const repairLogs = rawRepairLogs
      .filter(row => orderIds.has(row.orderId))
      .map(row => normalizeJsonFields(row, ['photoUrls', 'partUsages']))

    const rawPartLogs = rowsWithId(ensureArray(tables.sparePartLogs))
    const sparePartLogs = rawPartLogs.filter(row => partIds.has(row.partId))

    const rawInspectionRecords = rowsWithId(ensureArray(tables.inspectionRecords))
    const inspectionRecords = rawInspectionRecords
      .filter(row => planIds.has(row.planId))
      .map(row => normalizeJsonFields(row, ['photoUrls']))

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
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const projectId = req.headers['x-project-id']
    const start = startDate || new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10)
    const end = endDate || new Date().toISOString().slice(0,10)
    return this.svc.orderStats(projectId, start, end)
  }

  @Get('fault-analysis')
  faultAnalysis(@Request() req, @Query('months') months = 6) {
    return this.svc.faultAnalysis(req.headers['x-project-id'], +months)
  }

  @Get('engineer-performance')
  engineerPerformance(@Request() req, @Query('startDate') s: string, @Query('endDate') e: string) {
    return this.svc.engineerPerformance(req.headers['x-project-id'], s, e)
  }

  @Get('repair-cost')
  repairCost(@Request() req, @Query('startDate') s: string, @Query('endDate') e: string) {
    return this.svc.repairCostAnalysis(req.headers['x-project-id'], s, e)
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
