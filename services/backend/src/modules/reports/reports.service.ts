import { Injectable } from '@nestjs/common'
import { ReportsBackupService } from './reports-backup.service'
import { ReportsExportService } from './reports-export.service'
import { ReportsStatsService } from './reports-stats.service'

@Injectable()
export class ReportsService {
  constructor(
    private readonly statsService: ReportsStatsService,
    private readonly backupService: ReportsBackupService,
    private readonly exportService: ReportsExportService,
  ) {}

  orderStats(projectId: string, startDate: string, endDate: string) {
    return this.statsService.orderStats(projectId, startDate, endDate)
  }

  faultAnalysis(projectId: string, months = 6) {
    return this.statsService.faultAnalysis(projectId, months)
  }

  engineerPerformance(projectId: string, startDate: string, endDate: string) {
    return this.statsService.engineerPerformance(projectId, startDate, endDate)
  }

  repairCostAnalysis(projectId: string, startDate: string, endDate: string) {
    return this.statsService.repairCostAnalysis(projectId, startDate, endDate)
  }

  weeklyTrend(projectId: string) {
    return this.statsService.weeklyTrend(projectId)
  }

  deviceStatusDistribution(projectId: string) {
    return this.statsService.deviceStatusDistribution(projectId)
  }

  partsConsumptionRank(projectId: string) {
    return this.statsService.partsConsumptionRank(projectId)
  }

  operationsSummary(projectId: string, startDate: string, endDate: string) {
    return this.statsService.operationsSummary(projectId, startDate, endDate)
  }

  exportOrdersWorkbook(projectId: string, startDate: string, endDate: string) {
    return this.exportService.exportOrdersWorkbook(projectId, startDate, endDate)
  }

  exportDeviceInventoryWorkbook(projectId: string) {
    return this.exportService.exportDeviceInventoryWorkbook(projectId)
  }

  exportPartsInventoryWorkbook(projectId: string) {
    return this.exportService.exportPartsInventoryWorkbook(projectId)
  }

  exportPartsConsumptionWorkbook(projectId: string, startDate: string, endDate: string) {
    return this.exportService.exportPartsConsumptionWorkbook(projectId, startDate, endDate)
  }

  exportPerformanceWorkbook(projectId: string, startDate: string, endDate: string) {
    return this.exportService.exportPerformanceWorkbook(projectId, startDate, endDate)
  }

  exportFaultStatsWorkbook(projectId: string, startDate: string, endDate: string) {
    return this.exportService.exportFaultStatsWorkbook(projectId, startDate, endDate)
  }

  exportMonthlyPdfReport(projectId: string, year: number, month: number) {
    return this.exportService.exportMonthlyPdfReport(projectId, year, month)
  }

  backupProjectData(projectId: string) {
    return this.backupService.backupProjectData(projectId)
  }

  restoreProjectData(projectId: string, payload: unknown, dryRun = false) {
    return this.backupService.restoreProjectData(projectId, payload, dryRun)
  }
}
