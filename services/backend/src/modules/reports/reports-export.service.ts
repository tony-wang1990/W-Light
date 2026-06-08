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

  async exportDeviceInventoryWorkbook(projectId: string) {
    const rows = await this.query(`
      SELECT d.deviceNo, d.name, d.category, d.status, d.location, d.manufacturer, d.model, d.purchaseDate, d.warrantyUntil, d.createdAt
      FROM devices d WHERE d.projectId = ? ORDER BY d.createdAt DESC
    `, `
      SELECT d."deviceNo" as "deviceNo", d.name, d.category, d.status, d.location, d.manufacturer, d.model, d."purchaseDate" as "purchaseDate", d."warrantyUntil" as "warrantyUntil", d."createdAt" as "createdAt"
      FROM devices d WHERE d."projectId"::text = $1 ORDER BY d."createdAt" DESC
    `, [projectId])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('设备台账')
    sheet.columns = [
      { header: '设备编号', key: 'deviceNo', width: 18 },
      { header: '名称', key: 'name', width: 22 },
      { header: '分类', key: 'category', width: 14 },
      { header: '状态', key: 'status', width: 12 },
      { header: '位置', key: 'location', width: 24 },
      { header: '品牌/厂家', key: 'manufacturer', width: 16 },
      { header: '型号', key: 'model', width: 16 },
      { header: '采购日期', key: 'purchaseDate', width: 14 },
      { header: '质保到期', key: 'warrantyUntil', width: 14 },
      { header: '录入时间', key: 'createdAt', width: 20 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportPartsInventoryWorkbook(projectId: string) {
    const rows = await this.query(`
      SELECT p.partNo, p.name, p.category, p.specifications, p.unit, p.stockQuantity, p.minimumStock, p.unitPrice, p.location, p.updatedAt
      FROM spare_parts p WHERE p.projectId = ? ORDER BY p.updatedAt DESC
    `, `
      SELECT p."partNo" as "partNo", p.name, p.category, p.specifications, p.unit, p."stockQuantity" as "stockQuantity", p."minimumStock" as "minimumStock", p."unitPrice" as "unitPrice", p.location, p."updatedAt" as "updatedAt"
      FROM spare_parts p WHERE p."projectId"::text = $1 ORDER BY p."updatedAt" DESC
    `, [projectId])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('备品库存台账')
    sheet.columns = [
      { header: '备件编号', key: 'partNo', width: 18 },
      { header: '名称', key: 'name', width: 22 },
      { header: '类别', key: 'category', width: 14 },
      { header: '规格型号', key: 'specifications', width: 20 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '当前库存', key: 'stockQuantity', width: 12 },
      { header: '最低警戒线', key: 'minimumStock', width: 12 },
      { header: '单价', key: 'unitPrice', width: 12 },
      { header: '存放位置', key: 'location', width: 20 },
      { header: '最近更新', key: 'updatedAt', width: 20 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportPartsConsumptionWorkbook(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT o.orderNo, o.createdAt, p.partNo, p.name as partName, u.quantity, u.unitPrice, (u.quantity * u.unitPrice) as totalCost, c.name as engineerName
      FROM order_parts_usage u
      JOIN work_orders o ON o.id = u.orderId
      JOIN spare_parts p ON p.id = u.partId
      LEFT JOIN users c ON c.id = o.assigneeId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      ORDER BY o.createdAt DESC
    `, `
      SELECT o."orderNo" as "orderNo", o."createdAt" as "createdAt", p."partNo" as "partNo", p.name as "partName", u.quantity, u."unitPrice" as "unitPrice", (u.quantity * u."unitPrice") as "totalCost", c.name as "engineerName"
      FROM order_parts_usage u
      JOIN work_orders o ON o.id::text = u."orderId"::text
      JOIN spare_parts p ON p.id::text = u."partId"::text
      LEFT JOIN users c ON c.id::text = o."assigneeId"::text
      WHERE o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
      ORDER BY o."createdAt" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('备件消耗明细')
    sheet.columns = [
      { header: '关联工单', key: 'orderNo', width: 18 },
      { header: '工单日期', key: 'createdAt', width: 20 },
      { header: '备件编号', key: 'partNo', width: 18 },
      { header: '备件名称', key: 'partName', width: 22 },
      { header: '消耗数量', key: 'quantity', width: 12 },
      { header: '出库单价', key: 'unitPrice', width: 12 },
      { header: '总成本', key: 'totalCost', width: 14 },
      { header: '维修人', key: 'engineerName', width: 14 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportPerformanceWorkbook(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT u.name, u.role, 
        COUNT(o.id) as totalAssigned,
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as totalClosed,
        SUM(CASE WHEN o.isOvertime = 1 THEN 1 ELSE 0 END) as overtimeCount,
        AVG(CASE WHEN o.status = 'closed' AND o.closedAt IS NOT NULL AND o.startedAt IS NOT NULL 
            THEN (julianday(o.closedAt) - julianday(o.startedAt)) * 24 ELSE NULL END) as avgRepairHours
      FROM users u
      LEFT JOIN work_orders o ON o.assigneeId = u.id AND o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      WHERE u.role IN ('engineer', 'admin')
      GROUP BY u.id, u.name, u.role
      ORDER BY totalClosed DESC
    `, `
      SELECT u.name, u.role, 
        COUNT(o.id) as "totalAssigned",
        SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as "totalClosed",
        SUM(CASE WHEN o."isOvertime" = 1 OR o."isOvertime" = true THEN 1 ELSE 0 END) as "overtimeCount",
        AVG(CASE WHEN o.status = 'closed' AND o."closedAt" IS NOT NULL AND o."startedAt" IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (o."closedAt" - o."startedAt")) / 3600 ELSE NULL END) as "avgRepairHours"
      FROM users u
      LEFT JOIN work_orders o ON o.id::text = u.id::text AND o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
      WHERE u.role IN ('engineer', 'admin')
      GROUP BY u.id, u.name, u.role
      ORDER BY "totalClosed" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('工程师绩效考核')
    sheet.columns = [
      { header: '姓名', key: 'name', width: 14 },
      { header: '角色', key: 'role', width: 14 },
      { header: '派单总数', key: 'totalAssigned', width: 12 },
      { header: '完成总数', key: 'totalClosed', width: 12 },
      { header: '超时单数', key: 'overtimeCount', width: 12 },
      { header: '平均修复时长(小时)', key: 'avgRepairHours', width: 20 },
    ]
    rows.forEach(row => {
      sheet.addRow({
        ...row,
        avgRepairHours: row.avgRepairHours != null ? Number(row.avgRepairHours).toFixed(2) : '-',
        role: row.role === 'admin' ? '管理员' : '维修工程师',
      })
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportFaultStatsWorkbook(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT faultType, COUNT(id) as count, SUM(repairCost) as totalCost
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ? AND faultType IS NOT NULL AND faultType != ''
      GROUP BY faultType
      ORDER BY count DESC
    `, `
      SELECT "faultType", COUNT(id) as count, SUM("repairCost") as "totalCost"
      FROM work_orders
      WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3 AND "faultType" IS NOT NULL AND "faultType" != ''
      GROUP BY "faultType"
      ORDER BY count DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('故障分类统计')
    sheet.columns = [
      { header: '故障类型', key: 'faultType', width: 24 },
      { header: '发生次数', key: 'count', width: 14 },
      { header: '累计维修成本', key: 'totalCost', width: 18 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
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
