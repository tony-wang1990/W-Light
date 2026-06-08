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

  private query<T = Record<string, unknown>>(
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
      LEFT JOIN devices d ON d.id::text = o."deviceId"::text
      LEFT JOIN users reporter ON reporter.id::text = o."reporterId"::text
      LEFT JOIN users assignee ON assignee.id::text = o."assigneeId"::text
      WHERE o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
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

  async exportMonthlyPdfReport(projectId: string, year: number, month: number) {
    const PDFDocument = (await import('pdfkit')).default
    const path = await import('path')
    
    // 计算本月起止时间
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString()
    const prevMonthStartDate = new Date(year, month - 2, 1).toISOString()
    const prevMonthEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999).toISOString()

    // 查询当月数据
    const [currentOrders] = await this.query(
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId" = ? AND "createdAt" BETWEEN ? AND ?`,
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3`,
      [projectId, startDate, endDate]
    )

    // 查询上月数据用于环比
    const [prevOrders] = await this.query(
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId" = ? AND "createdAt" BETWEEN ? AND ?`,
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3`,
      [projectId, prevMonthStartDate, prevMonthEndDate]
    )

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const buffers: Buffer[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => resolve(Buffer.concat(buffers)))

        const fontPath = path.join(__dirname, '../../assets/fonts/simhei.ttf')
        try { doc.font(fontPath) } catch { /* ignore font load error */ }

        doc.fontSize(24).fillColor('#111827').text(`W-Light 项目月度运维报告`, { align: 'center' })
        doc.moveDown()
        doc.fontSize(14).fillColor('#666666').text(`报告期间：${year} 年 ${month} 月`, { align: 'center' })
        doc.moveDown(2)

        const curTotal = Number(currentOrders.total || 0)
        const curClosed = Number(currentOrders.closed || 0)
        const curCost = Number(currentOrders.cost || 0)
        const prevTotal = Number(prevOrders.total || 0)
        
        const rate = curTotal > 0 ? ((curClosed / curTotal) * 100).toFixed(1) : '100'
        const increase = curTotal - prevTotal

        doc.fontSize(18).fillColor('#111827').text('一、 工单核心指标')
        doc.moveDown(0.5)
        doc.fontSize(12).fillColor('#374151')
        doc.text(`本月新增工单：${curTotal} 单（较上月 ${increase > 0 ? '+' : ''}${increase}）`)
        doc.text(`本月完成工单：${curClosed} 单`)
        doc.text(`本月工单闭环率：${rate}%`)
        doc.text(`本月维修总支出：¥${curCost.toFixed(2)}`)
        doc.moveDown(2)

        doc.fontSize(18).fillColor('#111827').text('二、 系统评估')
        doc.moveDown(0.5)
        doc.fontSize(12).fillColor('#374151')
        if (curTotal === 0) {
          doc.text('本月无新发故障，系统运行极为平稳。')
        } else if (Number(rate) >= 95) {
          doc.text('本月运维响应迅速，大部分故障已及时处理，系统运行健康。')
        } else {
          doc.text('本月有部分工单未完成闭环，建议加强现场巡检和备件储备。')
        }

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}
