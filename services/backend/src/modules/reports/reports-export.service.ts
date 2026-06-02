import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as ExcelJS from 'exceljs'

@Injectable()
export class ReportsExportService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

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

  async exportOrdersWorkbook(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
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
    `, `
      SELECT
        o."orderNo" as "orderNo",
        o.category,
        o.priority,
        o.status,
        COALESCE(o."faultType", '') as "faultType",
        o."faultDesc" as "faultDesc",
        COALESCE(d."deviceNo", '') as "deviceNo",
        COALESCE(d.name, '') as "deviceName",
        COALESCE(d.location, o."locationDesc", '') as location,
        COALESCE(reporter.name, '') as "reporterName",
        COALESCE(assignee.name, '') as "assigneeName",
        o."createdAt" as "createdAt",
        o."assignedAt" as "assignedAt",
        o."startedAt" as "startedAt",
        o."submittedAt" as "submittedAt",
        o."closedAt" as "closedAt",
        o."isOvertime" as "isOvertime",
        o."repairCost" as "repairCost"
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o."deviceId"
      LEFT JOIN users reporter ON reporter.id = o."reporterId"
      LEFT JOIN users assignee ON assignee.id = o."assigneeId"
      WHERE o."projectId" = $1 AND o."createdAt" BETWEEN $2 AND $3
      ORDER BY o."createdAt" DESC
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
}
