import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller'
import { ReportsBackupService } from './reports-backup.service'
import { ReportsExportService } from './reports-export.service'
import { ReportsService } from './reports.service'

@Module({ controllers: [ReportsController], providers: [ReportsService, ReportsBackupService, ReportsExportService] })
export class ReportsModule {}
