import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller'
import { ReportsBackupService } from './reports-backup.service'
import { ReportsService } from './reports.service'

@Module({ controllers: [ReportsController], providers: [ReportsService, ReportsBackupService] })
export class ReportsModule {}
