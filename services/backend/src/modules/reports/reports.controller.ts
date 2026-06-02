import { Body, Controller, Get, Post, Query, Request, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ReportsService } from './reports.service'
import { normalizeDateRange } from './reports.utils'

@ApiTags('报表统计')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
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
