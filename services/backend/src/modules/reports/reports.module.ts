import { Module, Controller, Get, Query, UseGuards, Request } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Injectable()
class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async orderStats(projectId: string, startDate: string, endDate: string) {
    const rows = await this.ds.query(`
      SELECT 
        status, priority, COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (COALESCE("closedAt","updatedAt") - "startedAt"))/3600) as avg_hours
      FROM work_orders
      WHERE "projectId" = $1 AND "createdAt" BETWEEN $2 AND $3
      GROUP BY status, priority
    `, [projectId, startDate, endDate])
    return rows
  }

  async faultAnalysis(projectId: string, months = 6) {
    return this.ds.query(`
      SELECT 
        to_char("createdAt", 'YYYY-MM') as month,
        "faultType", COUNT(*) as count
      FROM work_orders
      WHERE "projectId" = $1 AND "createdAt" > NOW() - INTERVAL '${months} months'
      GROUP BY month, "faultType"
      ORDER BY month DESC
    `, [projectId])
  }

  async engineerPerformance(projectId: string, startDate: string, endDate: string) {
    return this.ds.query(`
      SELECT 
        u.name, u.id,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as completed,
        AVG(EXTRACT(EPOCH FROM (o."closedAt" - o."assignedAt"))/3600) as avg_response_hours
      FROM work_orders o
      JOIN users u ON u.id = o."assigneeId"
      WHERE o."projectId" = $1 AND o."createdAt" BETWEEN $2 AND $3
      GROUP BY u.id, u.name
      ORDER BY completed DESC
    `, [projectId, startDate, endDate])
  }

  async repairCostAnalysis(projectId: string, startDate: string, endDate: string) {
    return this.ds.query(`
      SELECT
        to_char("createdAt", 'YYYY-MM') as month,
        SUM("repairCost") as total_cost,
        COUNT(*) as order_count,
        AVG("repairCost") as avg_cost
      FROM work_orders
      WHERE "projectId" = $1 AND "createdAt" BETWEEN $2 AND $3 AND "repairCost" IS NOT NULL
      GROUP BY month ORDER BY month
    `, [projectId, startDate, endDate])
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
    return this.svc.orderStats(req.headers['x-project-id'], startDate, endDate)
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
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
