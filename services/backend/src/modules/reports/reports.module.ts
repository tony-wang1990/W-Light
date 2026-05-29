import { Module, Controller, Get, Query, UseGuards, Request } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

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
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
