import { Body, Controller, Get, Post, Query, Request, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ProjectAccessGuard } from '../../common/guards/project-access.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UserRole } from '../users/entities/user.entity'
import { ReportsService } from './reports.service'
import { normalizeDateRange } from './reports.utils'

@ApiTags('报表统计')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard)
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
    return this.svc.orderStats(req.projectId, range.start, range.end)
  }

  @Get('fault-analysis')
  faultAnalysis(@Request() req, @Query('months') months?: string) {
    return this.svc.faultAnalysis(req.projectId, Number(months || 6))
  }

  @Get('engineer-performance')
  engineerPerformance(@Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.engineerPerformance(req.projectId, range.start, range.end)
  }

  @Get('repair-cost')
  repairCost(@Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.repairCostAnalysis(req.projectId, range.start, range.end)
  }

  @Get('weekly-trend')
  weeklyTrend(@Request() req) {
    return this.svc.weeklyTrend(req.projectId)
  }

  @Get('device-status')
  deviceStatus(@Request() req) {
    return this.svc.deviceStatusDistribution(req.projectId)
  }

  @Get('parts-rank')
  partsRank(@Request() req) {
    return this.svc.partsConsumptionRank(req.projectId)
  }

  @Get('operations-summary')
  operationsSummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = normalizeDateRange(startDate, endDate)
    return this.svc.operationsSummary(req.projectId, range.start, range.end)
  }

  @Get('export/orders.xlsx')
  async exportOrders(
    @Request() req,
    @Res() res,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = normalizeDateRange(startDate, endDate)
    const buffer = await this.svc.exportOrdersWorkbook(req.projectId, range.start, range.end)
    const filename = `lightops-orders-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get('export/monthly-report.pdf')
  async exportMonthlyPdf(
    @Request() req,
    @Res() res,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const d = new Date()
    const targetYear = year ? Number(year) : d.getFullYear()
    const targetMonth = month ? Number(month) : d.getMonth() + 1
    const buffer = await this.svc.exportMonthlyPdfReport(req.projectId, targetYear, targetMonth)
    const filename = `lightops-report-${targetYear}-${targetMonth.toString().padStart(2, '0')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get('backup.json')
  @Roles(UserRole.ADMIN)
  async backup(@Request() req, @Res() res) {
    const data = await this.svc.backupProjectData(req.projectId)
    const filename = `lightops-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(data, null, 2))
  }

  @Post('backup/restore')
  @Roles(UserRole.ADMIN)
  restoreBackup(
    @Request() req,
    @Body() body: unknown,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.svc.restoreProjectData(
      req.projectId,
      body,
      dryRun === 'true' || dryRun === '1',
    )
  }
}
