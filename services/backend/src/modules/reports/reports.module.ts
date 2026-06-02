import { Module, Controller, Get, Query, UseGuards, Request } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

function normalizeDateRange(startDate?: string, endDate?: string) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const end = endDate || new Date().toISOString().slice(0, 10)
  return {
    start: start.length === 10 ? `${start} 00:00:00` : start,
    end: end.length === 10 ? `${end} 23:59:59` : end,
  }
}

@Injectable()
class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

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
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
