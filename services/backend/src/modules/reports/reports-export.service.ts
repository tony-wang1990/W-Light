import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as ExcelJS from 'exceljs'
import PDFDocument = require('pdfkit')
import JSZip = require('jszip')
import { existsSync } from 'fs'
import * as path from 'path'

interface MonthlyReportSection {
  name: string
  headers: string[]
  rows: string[][]
}

interface MonthlyReportData {
  year: number
  month: number
  startDate: string
  endDate: string
  metrics: Record<string, string>
  sections: MonthlyReportSection[]
}

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
      SELECT d.deviceNo, d.name, d.category, d.status, d.location, d.manufacturer, d.model, d.dmxAddress, d.channelCount, d.power, d.installDate, d.warrantyExpire, d.healthScore, d.createdAt
      FROM devices d WHERE d.projectId = ? ORDER BY d.createdAt DESC
    `, `
      SELECT d."deviceNo" as "deviceNo", d.name, d.category, d.status, d.location, d.manufacturer, d.model, d."dmxAddress" as "dmxAddress", d."channelCount" as "channelCount", d.power, d."installDate" as "installDate", d."warrantyExpire" as "warrantyExpire", d."healthScore" as "healthScore", d."createdAt" as "createdAt"
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
      { header: 'DMX地址', key: 'dmxAddress', width: 12 },
      { header: '通道数', key: 'channelCount', width: 10 },
      { header: '功率W', key: 'power', width: 10 },
      { header: '安装日期', key: 'installDate', width: 14 },
      { header: '质保到期', key: 'warrantyExpire', width: 14 },
      { header: '健康分', key: 'healthScore', width: 10 },
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
      SELECT p.id as partNo, p.name, p.model, p.unit, p.stock, p.minStock, p.unitPrice, p.supplier, p.supplierPhone, p.updatedAt
      FROM spare_parts p WHERE p.projectId = ? ORDER BY p.updatedAt DESC
    `, `
      SELECT p.id::text as "partNo", p.name, p.model, p.unit, p.stock, p."minStock" as "minStock", p."unitPrice" as "unitPrice", p.supplier, p."supplierPhone" as "supplierPhone", p."updatedAt" as "updatedAt"
      FROM spare_parts p WHERE p."projectId"::text = $1 ORDER BY p."updatedAt" DESC
    `, [projectId])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('备品库存台账')
    sheet.columns = [
      { header: '备件编号', key: 'partNo', width: 18 },
      { header: '名称', key: 'name', width: 22 },
      { header: '规格型号', key: 'model', width: 20 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '当前库存', key: 'stock', width: 12 },
      { header: '最低警戒线', key: 'minStock', width: 12 },
      { header: '单价', key: 'unitPrice', width: 12 },
      { header: '供应商', key: 'supplier', width: 20 },
      { header: '供应商电话', key: 'supplierPhone', width: 18 },
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
      SELECT o.orderNo, l.createdAt, p.id as partNo, p.name as partName, p.model as partModel, l.quantity, p.unitPrice, (l.quantity * COALESCE(p.unitPrice, 0)) as totalCost, c.name as engineerName,
             d.name as deviceName, COALESCE(d.location, o.locationDesc) as location, o.faultType, o.faultDesc
      FROM spare_part_logs l
      LEFT JOIN work_orders o ON o.id = l.orderId
      JOIN spare_parts p ON p.id = l.partId
      LEFT JOIN devices d ON d.id = o.deviceId
      LEFT JOIN users c ON c.id = l.operatorId
      WHERE p.projectId = ? AND l.opType = 'outbound' AND l.createdAt BETWEEN ? AND ?
      ORDER BY l.createdAt DESC
    `, `
      SELECT o."orderNo" as "orderNo", l."createdAt" as "createdAt", p.id::text as "partNo", p.name as "partName", p.model as "partModel", l.quantity, p."unitPrice" as "unitPrice", (l.quantity * COALESCE(p."unitPrice", 0)) as "totalCost", c.name as "engineerName",
             d.name as "deviceName", COALESCE(d.location, o."locationDesc") as location, o."faultType" as "faultType", o."faultDesc" as "faultDesc"
      FROM spare_part_logs l
      LEFT JOIN work_orders o ON o.id::text = l."orderId"::text
      JOIN spare_parts p ON p.id::text = l."partId"::text
      LEFT JOIN devices d ON d.id::text = o."deviceId"::text
      LEFT JOIN users c ON c.id::text = l."operatorId"::text
      WHERE p."projectId"::text = $1 AND l."opType" = 'outbound' AND l."createdAt" BETWEEN $2 AND $3
      ORDER BY l."createdAt" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('备件消耗明细')
    sheet.columns = [
      { header: '消耗日期', key: 'createdAt', width: 20 },
      { header: '关联工单', key: 'orderNo', width: 18 },
      { header: '关联设备', key: 'deviceName', width: 22 },
      { header: '所在位置', key: 'location', width: 24 },
      { header: '故障类型', key: 'faultType', width: 16 },
      { header: '故障描述', key: 'faultDesc', width: 30 },
      { header: '备件编号', key: 'partNo', width: 18 },
      { header: '备件名称', key: 'partName', width: 22 },
      { header: '规格型号', key: 'partModel', width: 18 },
      { header: '消耗数量', key: 'quantity', width: 12 },
      { header: '出库单价', key: 'unitPrice', width: 12 },
      { header: '总物料成本', key: 'totalCost', width: 16 },
      { header: '操作人/维修人', key: 'engineerName', width: 16 },
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
        SUM(o.repairCost) as totalRepairCost,
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
        SUM(CASE WHEN o."isOvertime" = true THEN 1 ELSE 0 END) as "overtimeCount",
        SUM(o."repairCost") as "totalRepairCost",
        AVG(CASE WHEN o.status = 'closed' AND o."closedAt" IS NOT NULL AND o."startedAt" IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (o."closedAt" - o."startedAt")) / 3600 ELSE NULL END) as "avgRepairHours"
      FROM users u
      LEFT JOIN work_orders o ON o."assigneeId"::text = u.id::text AND o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
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
      { header: '按期完工率', key: 'onTimeRate', width: 14 },
      { header: '超时单数', key: 'overtimeCount', width: 12 },
      { header: '平均修复时长(小时)', key: 'avgRepairHours', width: 20 },
      { header: '累计产生维修成本', key: 'totalRepairCost', width: 20 },
    ]
    rows.forEach(row => {
      const closed = Number(row.totalClosed) || 0;
      const overtime = Number(row.overtimeCount) || 0;
      const onTimeRate = closed > 0 ? (((closed - overtime) / closed) * 100).toFixed(1) + '%' : '-';
      
      sheet.addRow({
        ...row,
        onTimeRate,
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

  async exportFinancialConsumption(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT COALESCE(NULLIF(p.model, ''), '未分类') as category, p.name as partName, SUM(l.quantity) as totalQuantity, 
             MAX(COALESCE(p.unitPrice, 0)) as unitPrice, 
             SUM(l.quantity * COALESCE(p.unitPrice, 0)) as totalCost
      FROM spare_part_logs l
      JOIN spare_parts p ON p.id = l.partId
      WHERE p.projectId = ? AND l.opType = 'outbound' AND l.createdAt BETWEEN ? AND ?
      GROUP BY p.id, COALESCE(NULLIF(p.model, ''), '未分类'), p.name
      ORDER BY totalCost DESC
    `, `
      SELECT COALESCE(NULLIF(p.model, ''), '未分类') as category, p.name as "partName", SUM(l.quantity) as "totalQuantity", 
             MAX(COALESCE(p."unitPrice", 0)) as "unitPrice", 
             SUM(l.quantity * COALESCE(p."unitPrice", 0)) as "totalCost"
      FROM spare_part_logs l
      JOIN spare_parts p ON p.id::text = l."partId"::text
      WHERE p."projectId"::text = $1 AND l."opType" = 'outbound' AND l."createdAt" BETWEEN $2 AND $3
      GROUP BY p.id, COALESCE(NULLIF(p.model, ''), '未分类'), p.name
      ORDER BY "totalCost" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('备件资金消耗汇总')
    sheet.columns = [
      { header: '备件分类', key: 'category', width: 16 },
      { header: '备件名称', key: 'partName', width: 24 },
      { header: '消耗总数', key: 'totalQuantity', width: 14 },
      { header: '单价参考', key: 'unitPrice', width: 14 },
      { header: '资金消耗总额', key: 'totalCost', width: 18 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportDeviceReliability(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT COALESCE(d.manufacturer, '未知') as manufacturer, d.category, 
             COUNT(DISTINCT d.id) as totalDevices, 
             COUNT(o.id) as faultCount
      FROM devices d
      LEFT JOIN work_orders o ON o.deviceId = d.id AND o.createdAt BETWEEN ? AND ?
      WHERE d.projectId = ?
      GROUP BY COALESCE(d.manufacturer, '未知'), d.category
      ORDER BY faultCount DESC
    `, `
      SELECT COALESCE(d.manufacturer, '未知') as manufacturer, d.category, 
             COUNT(DISTINCT d.id) as "totalDevices", 
             COUNT(o.id) as "faultCount"
      FROM devices d
      LEFT JOIN work_orders o ON o."deviceId"::text = d.id::text AND o."createdAt" BETWEEN $1 AND $2
      WHERE d."projectId"::text = $3
      GROUP BY COALESCE(d.manufacturer, '未知'), d.category
      ORDER BY "faultCount" DESC
    `, [startDate, endDate, projectId])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('设备质量评估汇总')
    sheet.columns = [
      { header: '品牌/厂家', key: 'manufacturer', width: 20 },
      { header: '设备分类', key: 'category', width: 16 },
      { header: '保有量', key: 'totalDevices', width: 14 },
      { header: '区间故障总数', key: 'faultCount', width: 16 },
      { header: '区间故障率', key: 'failureRate', width: 14 },
    ]
    rows.forEach(row => {
      const total = Number(row.totalDevices) || 0
      const faults = Number(row.faultCount) || 0
      sheet.addRow({
        ...row,
        failureRate: total > 0 ? ((faults / total) * 100).toFixed(2) + '%' : '0.00%',
      })
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportLocationHeatmap(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT COALESCE(d.location, o.locationDesc, '未知区域') as location, 
             COUNT(o.id) as faultCount, 
             SUM(o.repairCost) as totalCost
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o.deviceId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      GROUP BY COALESCE(d.location, o.locationDesc, '未知区域')
      ORDER BY faultCount DESC
    `, `
      SELECT COALESCE(d.location, o."locationDesc", '未知区域') as location, 
             COUNT(o.id) as "faultCount", 
             SUM(o."repairCost") as "totalCost"
      FROM work_orders o
      LEFT JOIN devices d ON d.id::text = o."deviceId"::text
      WHERE o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
      GROUP BY COALESCE(d.location, o."locationDesc", '未知区域')
      ORDER BY "faultCount" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('区域故障热力汇总')
    sheet.columns = [
      { header: '物理区域', key: 'location', width: 30 },
      { header: '故障总数', key: 'faultCount', width: 14 },
      { header: '累计维修成本', key: 'totalCost', width: 18 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportDailyKpi(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT DATE(createdAt) as date,
             COUNT(id) as newOrders,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closedOrders,
             SUM(CASE WHEN isOvertime = 1 OR isOvertime = 'true' THEN 1 ELSE 0 END) as overtimeOrders
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, `
      SELECT DATE("createdAt") as date,
             COUNT(id) as "newOrders",
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as "closedOrders",
             SUM(CASE WHEN "isOvertime" = true THEN 1 ELSE 0 END) as "overtimeOrders"
      FROM work_orders
      WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('每日运营走势')
    sheet.columns = [
      { header: '日期', key: 'date', width: 16 },
      { header: '新增工单数', key: 'newOrders', width: 16 },
      { header: '结案工单数', key: 'closedOrders', width: 16 },
      { header: '超时告警数', key: 'overtimeOrders', width: 16 },
    ]
    rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportInspectionAnomaly(projectId: string, startDate: string, endDate: string) {
    const rows = await this.query(`
      SELECT i.inspectedAt, i.status, i.resultDesc, u.name as inspectorName, p.name as planName, o.orderNo
      FROM inspection_records i
      JOIN inspection_plans p ON p.id = i.planId
      LEFT JOIN users u ON u.id = i.inspectorId
      LEFT JOIN work_orders o ON o.id = i.orderId
      WHERE p.projectId = ? AND i.status != 'normal' AND i.inspectedAt BETWEEN ? AND ?
      ORDER BY i.inspectedAt DESC
    `, `
      SELECT i."inspectedAt" as "inspectedAt", i.status, i."resultDesc" as "resultDesc", u.name as "inspectorName", p.name as "planName", o."orderNo" as "orderNo"
      FROM inspection_records i
      JOIN inspection_plans p ON p.id::text = i."planId"::text
      LEFT JOIN users u ON u.id::text = i."inspectorId"::text
      LEFT JOIN work_orders o ON o.id::text = i."orderId"::text
      WHERE p."projectId"::text = $1 AND i.status != 'normal' AND i."inspectedAt" BETWEEN $2 AND $3
      ORDER BY i."inspectedAt" DESC
    `, [projectId, startDate, endDate])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('巡检异常统计')
    sheet.columns = [
      { header: '巡检时间', key: 'inspectedAt', width: 22 },
      { header: '所属计划', key: 'planName', width: 24 },
      { header: '状态', key: 'status', width: 14 },
      { header: '异常描述', key: 'resultDesc', width: 36 },
      { header: '巡检人', key: 'inspectorName', width: 16 },
      { header: '关联工单', key: 'orderNo', width: 20 },
    ]
    rows.forEach(row => sheet.addRow({
      ...row,
      status: row.status === 'abnormal' ? '异常' : row.status === 'skipped' ? '跳过/漏检' : row.status,
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  async exportMonthlyOperationsWorkbook(projectId: string, startDate: string, endDate: string) {
    const [overview = {}] = await this.query(`
      SELECT
        COUNT(id) as totalOrders,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closedOrders,
        SUM(CASE WHEN status IN ('pending', 'assigned', 'processing', 'reviewing') THEN 1 ELSE 0 END) as activeOrders,
        SUM(CASE WHEN isOvertime = 1 OR isOvertime = 'true' THEN 1 ELSE 0 END) as overtimeOrders,
        SUM(COALESCE(repairCost, 0)) as totalRepairCost,
        AVG(CASE WHEN closedAt IS NOT NULL AND startedAt IS NOT NULL THEN (julianday(closedAt) - julianday(startedAt)) * 24 ELSE NULL END) as avgRepairHours,
        AVG(CASE WHEN assignedAt IS NOT NULL THEN (julianday(assignedAt) - julianday(createdAt)) * 24 ELSE NULL END) as avgResponseHours
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
    `, `
      SELECT
        COUNT(id) as "totalOrders",
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as "closedOrders",
        SUM(CASE WHEN status IN ('pending', 'assigned', 'processing', 'reviewing') THEN 1 ELSE 0 END) as "activeOrders",
        SUM(CASE WHEN "isOvertime" = true THEN 1 ELSE 0 END) as "overtimeOrders",
        SUM(COALESCE("repairCost", 0)) as "totalRepairCost",
        AVG(CASE WHEN "closedAt" IS NOT NULL AND "startedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("closedAt" - "startedAt")) / 3600 ELSE NULL END) as "avgRepairHours",
        AVG(CASE WHEN "assignedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("assignedAt" - "createdAt")) / 3600 ELSE NULL END) as "avgResponseHours"
      FROM work_orders
      WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3
    `, [projectId, startDate, endDate])

    const faultRows = await this.query(`
      SELECT COALESCE(faultType, '未分类') as faultType,
             COUNT(id) as faultCount,
             SUM(COALESCE(repairCost, 0)) as totalCost,
             AVG(CASE WHEN closedAt IS NOT NULL AND startedAt IS NOT NULL THEN (julianday(closedAt) - julianday(startedAt)) * 24 ELSE NULL END) as avgRepairHours
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
      GROUP BY COALESCE(faultType, '未分类')
      ORDER BY faultCount DESC
    `, `
      SELECT COALESCE("faultType", '未分类') as "faultType",
             COUNT(id) as "faultCount",
             SUM(COALESCE("repairCost", 0)) as "totalCost",
             AVG(CASE WHEN "closedAt" IS NOT NULL AND "startedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("closedAt" - "startedAt")) / 3600 ELSE NULL END) as "avgRepairHours"
      FROM work_orders
      WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3
      GROUP BY COALESCE("faultType", '未分类')
      ORDER BY "faultCount" DESC
    `, [projectId, startDate, endDate])

    const deviceRows = await this.query(`
      SELECT COALESCE(d.deviceNo, '未绑定') as deviceNo,
             COALESCE(d.name, '未绑定设备') as deviceName,
             COALESCE(d.category, '未分类') as category,
             COALESCE(d.manufacturer, '未知厂家') as manufacturer,
             COALESCE(d.location, o.locationDesc, '未知区域') as location,
             COUNT(o.id) as faultCount,
             SUM(COALESCE(o.repairCost, 0)) as totalCost,
             MAX(o.createdAt) as lastFaultAt
      FROM work_orders o
      LEFT JOIN devices d ON d.id = o.deviceId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      GROUP BY COALESCE(d.deviceNo, '未绑定'), COALESCE(d.name, '未绑定设备'), COALESCE(d.category, '未分类'), COALESCE(d.manufacturer, '未知厂家'), COALESCE(d.location, o.locationDesc, '未知区域')
      ORDER BY faultCount DESC
      LIMIT 50
    `, `
      SELECT COALESCE(d."deviceNo", '未绑定') as "deviceNo",
             COALESCE(d.name, '未绑定设备') as "deviceName",
             COALESCE(d.category, '未分类') as category,
             COALESCE(d.manufacturer, '未知厂家') as manufacturer,
             COALESCE(d.location, o."locationDesc", '未知区域') as location,
             COUNT(o.id) as "faultCount",
             SUM(COALESCE(o."repairCost", 0)) as "totalCost",
             MAX(o."createdAt") as "lastFaultAt"
      FROM work_orders o
      LEFT JOIN devices d ON d.id::text = o."deviceId"::text
      WHERE o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
      GROUP BY COALESCE(d."deviceNo", '未绑定'), COALESCE(d.name, '未绑定设备'), COALESCE(d.category, '未分类'), COALESCE(d.manufacturer, '未知厂家'), COALESCE(d.location, o."locationDesc", '未知区域')
      ORDER BY "faultCount" DESC
      LIMIT 50
    `, [projectId, startDate, endDate])

    const engineerRows = await this.query(`
      SELECT COALESCE(u.name, '未分配') as engineerName,
             COUNT(o.id) as totalOrders,
             SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as closedOrders,
             SUM(CASE WHEN o.isOvertime = 1 OR o.isOvertime = 'true' THEN 1 ELSE 0 END) as overtimeOrders,
             SUM(COALESCE(o.repairCost, 0)) as totalRepairCost,
             AVG(CASE WHEN o.closedAt IS NOT NULL AND o.startedAt IS NOT NULL THEN (julianday(o.closedAt) - julianday(o.startedAt)) * 24 ELSE NULL END) as avgRepairHours
      FROM work_orders o
      LEFT JOIN users u ON u.id = o.assigneeId
      WHERE o.projectId = ? AND o.createdAt BETWEEN ? AND ?
      GROUP BY COALESCE(u.name, '未分配')
      ORDER BY closedOrders DESC, totalOrders DESC
    `, `
      SELECT COALESCE(u.name, '未分配') as "engineerName",
             COUNT(o.id) as "totalOrders",
             SUM(CASE WHEN o.status = 'closed' THEN 1 ELSE 0 END) as "closedOrders",
             SUM(CASE WHEN o."isOvertime" = true THEN 1 ELSE 0 END) as "overtimeOrders",
             SUM(COALESCE(o."repairCost", 0)) as "totalRepairCost",
             AVG(CASE WHEN o."closedAt" IS NOT NULL AND o."startedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (o."closedAt" - o."startedAt")) / 3600 ELSE NULL END) as "avgRepairHours"
      FROM work_orders o
      LEFT JOIN users u ON u.id::text = o."assigneeId"::text
      WHERE o."projectId"::text = $1 AND o."createdAt" BETWEEN $2 AND $3
      GROUP BY COALESCE(u.name, '未分配')
      ORDER BY "closedOrders" DESC, "totalOrders" DESC
    `, [projectId, startDate, endDate])

    const partsRows = await this.query(`
      SELECT p.name as partName,
             p.model as partModel,
             p.unit,
             SUM(l.quantity) as consumedQuantity,
             MAX(COALESCE(p.unitPrice, 0)) as unitPrice,
             SUM(l.quantity * COALESCE(p.unitPrice, 0)) as totalCost,
             COUNT(DISTINCT l.orderId) as orderCount
      FROM spare_part_logs l
      JOIN spare_parts p ON p.id = l.partId
      WHERE p.projectId = ? AND l.opType = 'outbound' AND l.createdAt BETWEEN ? AND ?
      GROUP BY p.id, p.name, p.model, p.unit
      ORDER BY totalCost DESC
      LIMIT 50
    `, `
      SELECT p.name as "partName",
             p.model as "partModel",
             p.unit,
             SUM(l.quantity) as "consumedQuantity",
             MAX(COALESCE(p."unitPrice", 0)) as "unitPrice",
             SUM(l.quantity * COALESCE(p."unitPrice", 0)) as "totalCost",
             COUNT(DISTINCT l."orderId") as "orderCount"
      FROM spare_part_logs l
      JOIN spare_parts p ON p.id::text = l."partId"::text
      WHERE p."projectId"::text = $1 AND l."opType" = 'outbound' AND l."createdAt" BETWEEN $2 AND $3
      GROUP BY p.id, p.name, p.model, p.unit
      ORDER BY "totalCost" DESC
      LIMIT 50
    `, [projectId, startDate, endDate])

    const dailyRows = await this.query(`
      SELECT DATE(createdAt) as date,
             COUNT(id) as newOrders,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closedOrders,
             SUM(CASE WHEN isOvertime = 1 OR isOvertime = 'true' THEN 1 ELSE 0 END) as overtimeOrders,
             SUM(COALESCE(repairCost, 0)) as repairCost
      FROM work_orders
      WHERE projectId = ? AND createdAt BETWEEN ? AND ?
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, `
      SELECT DATE("createdAt") as date,
             COUNT(id) as "newOrders",
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as "closedOrders",
             SUM(CASE WHEN "isOvertime" = true THEN 1 ELSE 0 END) as "overtimeOrders",
             SUM(COALESCE("repairCost", 0)) as "repairCost"
      FROM work_orders
      WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `, [projectId, startDate, endDate])

    const lowStockRows = await this.query(`
      SELECT name, model, unit, stock, minStock FROM spare_parts
      WHERE projectId = ? AND stock <= minStock
      ORDER BY stock ASC
      LIMIT 30
    `, `
      SELECT name, model, unit, stock, "minStock" as "minStock" FROM spare_parts
      WHERE "projectId"::text = $1 AND stock <= "minStock"
      ORDER BY stock ASC
      LIMIT 30
    `, [projectId])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'LightOps'
    workbook.created = new Date()

    const styleSheet = (sheet: ExcelJS.Worksheet, color = 'FFEFF6FF') => {
      sheet.getRow(1).font = { bold: true }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
    }

    const totalOrders = Number(overview.totalOrders || 0)
    const closedOrders = Number(overview.closedOrders || 0)
    const activeOrders = Number(overview.activeOrders || 0)
    const overtimeOrders = Number(overview.overtimeOrders || 0)
    const totalRepairCost = Number(overview.totalRepairCost || 0)
    const avgRepairHours = Number(overview.avgRepairHours || 0)
    const avgResponseHours = Number(overview.avgResponseHours || 0)
    const closureRate = totalOrders > 0 ? Number(((closedOrders / totalOrders) * 100).toFixed(1)) : 100

    const overviewSheet = workbook.addWorksheet('核心指标')
    overviewSheet.columns = [
      { header: '指标', key: 'metric', width: 24 },
      { header: '数值', key: 'value', width: 22 },
      { header: '说明', key: 'note', width: 46 },
    ]
    overviewSheet.addRows([
      { metric: '统计范围', value: `${startDate} 至 ${endDate}`, note: '按工单创建时间统计' },
      { metric: '工单总数', value: totalOrders, note: '周期内新增工单' },
      { metric: '闭环归档工单', value: closedOrders, note: '状态为 closed' },
      { metric: '未闭环工单', value: activeOrders, note: 'pending / assigned / processing / reviewing' },
      { metric: '闭环率', value: `${closureRate}%`, note: '闭环工单 / 总工单' },
      { metric: '超时工单', value: overtimeOrders, note: 'SLA 超时标记' },
      { metric: '维修总成本', value: totalRepairCost.toFixed(2), note: '工单 repairCost 汇总' },
      { metric: '平均维修时长', value: `${avgRepairHours.toFixed(2)} h`, note: 'startedAt 到 closedAt' },
      { metric: '平均响应时长', value: `${avgResponseHours.toFixed(2)} h`, note: 'createdAt 到 assignedAt' },
    ])
    styleSheet(overviewSheet, 'FFECFDF5')

    const faultSheet = workbook.addWorksheet('故障类型')
    faultSheet.columns = [
      { header: '故障类型', key: 'faultType', width: 24 },
      { header: '次数', key: 'faultCount', width: 12 },
      { header: '成本', key: 'totalCost', width: 14 },
      { header: '平均维修时长(h)', key: 'avgRepairHours', width: 18 },
    ]
    faultRows.forEach(row => faultSheet.addRow({
      ...row,
      totalCost: Number(row.totalCost || 0).toFixed(2),
      avgRepairHours: row.avgRepairHours == null ? '-' : Number(row.avgRepairHours).toFixed(2),
    }))
    styleSheet(faultSheet, 'FFFEF2F2')

    const deviceSheet = workbook.addWorksheet('设备故障率')
    deviceSheet.columns = [
      { header: '设备编号', key: 'deviceNo', width: 18 },
      { header: '设备名称', key: 'deviceName', width: 22 },
      { header: '分类', key: 'category', width: 14 },
      { header: '厂家', key: 'manufacturer', width: 18 },
      { header: '位置', key: 'location', width: 24 },
      { header: '故障次数', key: 'faultCount', width: 12 },
      { header: '维修成本', key: 'totalCost', width: 14 },
      { header: '最近故障', key: 'lastFaultAt', width: 22 },
    ]
    deviceRows.forEach(row => deviceSheet.addRow({
      ...row,
      totalCost: Number(row.totalCost || 0).toFixed(2),
    }))
    styleSheet(deviceSheet, 'FFF3F4F6')

    const engineerSheet = workbook.addWorksheet('人员绩效')
    engineerSheet.columns = [
      { header: '人员', key: 'engineerName', width: 18 },
      { header: '接单数', key: 'totalOrders', width: 12 },
      { header: '闭环数', key: 'closedOrders', width: 12 },
      { header: '闭环率', key: 'closureRate', width: 12 },
      { header: '超时数', key: 'overtimeOrders', width: 12 },
      { header: '平均维修时长(h)', key: 'avgRepairHours', width: 18 },
      { header: '维修成本', key: 'totalRepairCost', width: 14 },
    ]
    engineerRows.forEach(row => {
      const total = Number(row.totalOrders || 0)
      const closed = Number(row.closedOrders || 0)
      engineerSheet.addRow({
        ...row,
        closureRate: total > 0 ? `${((closed / total) * 100).toFixed(1)}%` : '-',
        avgRepairHours: row.avgRepairHours == null ? '-' : Number(row.avgRepairHours).toFixed(2),
        totalRepairCost: Number(row.totalRepairCost || 0).toFixed(2),
      })
    })
    styleSheet(engineerSheet, 'FFF0FDF4')

    const partsSheet = workbook.addWorksheet('维修成本与备件')
    partsSheet.columns = [
      { header: '备件名称', key: 'partName', width: 22 },
      { header: '规格型号', key: 'partModel', width: 18 },
      { header: '消耗数量', key: 'consumedQuantity', width: 12 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '单价', key: 'unitPrice', width: 12 },
      { header: '总成本', key: 'totalCost', width: 14 },
      { header: '关联工单数', key: 'orderCount', width: 14 },
    ]
    partsRows.forEach(row => partsSheet.addRow({
      ...row,
      unitPrice: Number(row.unitPrice || 0).toFixed(2),
      totalCost: Number(row.totalCost || 0).toFixed(2),
    }))
    styleSheet(partsSheet, 'FFFFFBEB')

    const dailySheet = workbook.addWorksheet('每日走势')
    dailySheet.columns = [
      { header: '日期', key: 'date', width: 16 },
      { header: '新增工单', key: 'newOrders', width: 12 },
      { header: '闭环工单', key: 'closedOrders', width: 12 },
      { header: '超时工单', key: 'overtimeOrders', width: 12 },
      { header: '维修成本', key: 'repairCost', width: 14 },
    ]
    dailyRows.forEach(row => dailySheet.addRow({
      ...row,
      repairCost: Number(row.repairCost || 0).toFixed(2),
    }))
    styleSheet(dailySheet, 'FFEFF6FF')

    const suggestions: string[] = []
    if (closureRate < 90) suggestions.push('闭环率低于 90%，建议检查派单、验收和超时提醒流程。')
    if (overtimeOrders > 0) suggestions.push('存在超时工单，建议按区域/人员复盘响应时长和备件准备。')
    if (avgRepairHours > 24) suggestions.push('平均维修时长超过 24 小时，建议建立高频故障备件包和疑难故障升级机制。')
    if (deviceRows.length > 0 && Number(deviceRows[0].faultCount || 0) >= 2) {
      suggestions.push(`设备 ${deviceRows[0].deviceNo || deviceRows[0].deviceName} 周期内重复故障，建议纳入重点巡检或替换评估。`)
    }
    if (lowStockRows.length > 0) suggestions.push(`有 ${lowStockRows.length} 种备件低于警戒线，建议尽快补库。`)
    if (suggestions.length === 0) suggestions.push('本周期关键指标稳定，建议保持巡检频率并继续沉淀维修记录。')

    const suggestionSheet = workbook.addWorksheet('运营建议')
    suggestionSheet.columns = [
      { header: '序号', key: 'index', width: 10 },
      { header: '建议', key: 'suggestion', width: 80 },
    ]
    suggestions.forEach((suggestion, index) => suggestionSheet.addRow({ index: index + 1, suggestion }))
    styleSheet(suggestionSheet, 'FFE0F2FE')

    const lowStockSheet = workbook.addWorksheet('低库存预警')
    lowStockSheet.columns = [
      { header: '备件名称', key: 'name', width: 22 },
      { header: '规格型号', key: 'model', width: 18 },
      { header: '当前库存', key: 'stock', width: 12 },
      { header: '警戒线', key: 'minStock', width: 12 },
      { header: '单位', key: 'unit', width: 8 },
    ]
    lowStockRows.forEach(row => lowStockSheet.addRow(row))
    styleSheet(lowStockSheet, 'FFFFEDD5')

    return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer)
  }

  private monthlyDateRange(year: number, month: number) {
    return {
      startDate: new Date(year, month - 1, 1).toISOString(),
      endDate: new Date(year, month, 0, 23, 59, 59, 999).toISOString(),
    }
  }

  private cellText(value: ExcelJS.CellValue) {
    if (value == null) return ''
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    if (typeof value === 'object') {
      if ('text' in value && value.text != null) return String(value.text)
      if ('richText' in value && Array.isArray(value.richText)) return value.richText.map(part => part.text).join('')
      if ('result' in value && value.result != null) return this.cellText(value.result as ExcelJS.CellValue)
      if ('formula' in value) return String(value.formula)
    }
    return String(value)
  }

  private worksheetToSection(sheet: ExcelJS.Worksheet): MonthlyReportSection {
    const headers = sheet.getRow(1).values as ExcelJS.CellValue[]
    const normalizedHeaders = headers.slice(1).map(value => this.cellText(value))
    const rows: string[][] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values = row.values as ExcelJS.CellValue[]
      const normalized = normalizedHeaders.map((_, index) => this.cellText(values[index + 1]))
      if (normalized.some(value => value !== '')) rows.push(normalized)
    })
    return { name: sheet.name, headers: normalizedHeaders, rows }
  }

  private async loadMonthlyReportData(projectId: string, year: number, month: number): Promise<MonthlyReportData> {
    const { startDate, endDate } = this.monthlyDateRange(year, month)
    const workbookBuffer = await this.exportMonthlyOperationsWorkbook(projectId, startDate, endDate)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(workbookBuffer as unknown as ArrayBuffer)

    const sections = workbook.worksheets.map(sheet => this.worksheetToSection(sheet))
    const metrics: Record<string, string> = {}
    const overview = sections.find(section => section.name === '核心指标')
    overview?.rows.forEach(row => {
      if (row[0]) metrics[row[0]] = row[1] || ''
    })

    return { year, month, startDate, endDate, metrics, sections }
  }

  private section(data: MonthlyReportData, name: string) {
    return data.sections.find(section => section.name === name)
  }

  private numeric(value: unknown) {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  private ratio(value: number, total: number) {
    if (total <= 0) return 0
    return Math.min(100, Math.max(0, (value / total) * 100))
  }

  private barText(value: number, total: number, width = 18) {
    const percent = this.ratio(value, total)
    const filled = Math.round((percent / 100) * width)
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${percent.toFixed(1)}%`
  }

  private escapeXml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private ensurePdfSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) doc.addPage()
  }

  private drawPdfSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensurePdfSpace(doc, 44)
    doc.moveDown(0.7)
    doc.fontSize(15).fillColor('#0F172A').text(title, { continued: false })
    doc.moveTo(doc.page.margins.left, doc.y + 5)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 5)
      .strokeColor('#E5E7EB')
      .stroke()
    doc.moveDown(0.8)
  }

  private drawPdfKpiCards(doc: PDFKit.PDFDocument, data: MonthlyReportData) {
    const metrics = [
      ['工单总数', data.metrics['工单总数'] || '0'],
      ['闭环率', data.metrics['闭环率'] || '0%'],
      ['超时工单', data.metrics['超时工单'] || '0'],
      ['维修总成本', `¥${data.metrics['维修总成本'] || '0.00'}`],
      ['平均维修时长', data.metrics['平均维修时长'] || '0 h'],
      ['平均响应时长', data.metrics['平均响应时长'] || '0 h'],
    ]
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const gap = 10
    const cardWidth = (pageWidth - gap * 2) / 3
    const cardHeight = 58
    let x = doc.page.margins.left
    let y = doc.y

    metrics.forEach(([label, value], index) => {
      if (index > 0 && index % 3 === 0) {
        x = doc.page.margins.left
        y += cardHeight + gap
      }
      doc.roundedRect(x, y, cardWidth, cardHeight, 8).fillAndStroke('#F8FAFC', '#E5E7EB')
      doc.fontSize(9).fillColor('#64748B').text(label, x + 12, y + 11, { width: cardWidth - 24 })
      doc.fontSize(17).fillColor('#0F172A').text(value, x + 12, y + 29, { width: cardWidth - 24 })
      x += cardWidth + gap
    })
    doc.y = y + cardHeight + 8
  }

  private drawPdfBars(
    doc: PDFKit.PDFDocument,
    title: string,
    section: MonthlyReportSection | undefined,
    labelHeader: string,
    valueHeader: string,
    color: string,
    limit = 8,
  ) {
    this.drawPdfSectionTitle(doc, title)
    if (!section || section.rows.length === 0) {
      doc.fontSize(10).fillColor('#94A3B8').text('暂无数据')
      return
    }
    const labelIndex = section.headers.indexOf(labelHeader)
    const valueIndex = section.headers.indexOf(valueHeader)
    const rows = section.rows.slice(0, limit)
    const max = Math.max(1, ...rows.map(row => this.numeric(row[valueIndex])))
    const x = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

    rows.forEach(row => {
      this.ensurePdfSpace(doc, 28)
      const value = this.numeric(row[valueIndex])
      const barWidth = Math.max(6, (value / max) * (width - 190))
      const y = doc.y
      doc.fontSize(9).fillColor('#334155').text(row[labelIndex] || '未命名', x, y, { width: 142, ellipsis: true })
      doc.roundedRect(x + 150, y + 2, width - 205, 9, 5).fill('#EEF2F7')
      doc.roundedRect(x + 150, y + 2, barWidth, 9, 5).fill(color)
      doc.fontSize(9).fillColor('#0F172A').text(String(row[valueIndex] || 0), x + width - 48, y - 1, { width: 48, align: 'right' })
      doc.y = y + 22
    })
  }

  private drawPdfTable(doc: PDFKit.PDFDocument, title: string, section: MonthlyReportSection | undefined, limit = 8) {
    this.drawPdfSectionTitle(doc, title)
    if (!section || section.rows.length === 0) {
      doc.fontSize(10).fillColor('#94A3B8').text('暂无数据')
      return
    }
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const columns = section.headers.slice(0, 5)
    const colWidth = pageWidth / columns.length
    const startX = doc.page.margins.left
    const drawRow = (cells: string[], fill: string) => {
      this.ensurePdfSpace(doc, 25)
      const y = doc.y
      cells.forEach((cell, index) => {
        const x = startX + index * colWidth
        doc.rect(x, y, colWidth, 22).fillAndStroke(fill, '#E5E7EB')
        doc.fontSize(8).fillColor('#0F172A')
        doc.text(cell || '-', x + 5, y + 6, { width: colWidth - 10, height: 12, ellipsis: true })
      })
      doc.y = y + 22
    }
    drawRow(columns, '#F1F5F9')
    section.rows.slice(0, limit).forEach(row => drawRow(row.slice(0, 5), '#FFFFFF'))
  }

  private docxParagraph(text: string, style = 'Normal') {
    const styleXml = style ? `<w:pStyle w:val="${style}"/>` : ''
    return `<w:p><w:pPr>${styleXml}<w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/></w:rPr><w:t xml:space="preserve">${this.escapeXml(text)}</w:t></w:r></w:p>`
  }

  private docxTable(headers: string[], rows: string[][], limit = 12) {
    const widths = headers.map(() => Math.floor(9360 / Math.max(1, headers.length)))
    const cell = (text: string, width: number, fill = 'FFFFFF', bold = false) => `
      <w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${fill}"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>
      <w:p><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/>${bold ? '<w:b/>' : ''}<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${this.escapeXml(text || '-')}</w:t></w:r></w:p></w:tc>`
    const rowXml = (cells: string[], fill = 'FFFFFF', bold = false) => `<w:tr>${headers.map((_, index) => cell(cells[index] || '', widths[index], fill, bold)).join('')}</w:tr>`
    return `
      <w:tbl>
        <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="E5E7EB"/><w:left w:val="single" w:sz="4" w:color="E5E7EB"/><w:bottom w:val="single" w:sz="4" w:color="E5E7EB"/><w:right w:val="single" w:sz="4" w:color="E5E7EB"/><w:insideH w:val="single" w:sz="4" w:color="E5E7EB"/><w:insideV w:val="single" w:sz="4" w:color="E5E7EB"/></w:tblBorders></w:tblPr>
        <w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>
        ${rowXml(headers, 'EAF2FF', true)}
        ${rows.slice(0, limit).map(row => rowXml(row)).join('')}
      </w:tbl>
      <w:p/>`
  }

  private buildDocxDocumentXml(data: MonthlyReportData) {
    const overview = this.section(data, '核心指标')
    const fault = this.section(data, '故障类型')
    const device = this.section(data, '设备故障率')
    const engineer = this.section(data, '人员绩效')
    const parts = this.section(data, '维修成本与备件')
    const daily = this.section(data, '每日走势')
    const suggestions = this.section(data, '运营建议')
    const lowStock = this.section(data, '低库存预警')
    const totalOrders = this.numeric(data.metrics['工单总数'])
    const closedOrders = this.numeric(data.metrics['闭环归档工单'])
    const activeOrders = this.numeric(data.metrics['未闭环工单'])
    const overtimeOrders = this.numeric(data.metrics['超时工单'])
    const visualRows = [
      ['闭环归档', String(closedOrders), this.barText(closedOrders, totalOrders)],
      ['未闭环', String(activeOrders), this.barText(activeOrders, totalOrders)],
      ['超时', String(overtimeOrders), this.barText(overtimeOrders, totalOrders)],
    ]

    const partsXml = [
      this.docxParagraph('W-Light 项目月度运维报告', 'Title'),
      this.docxParagraph(`报告期间：${data.year} 年 ${data.month.toString().padStart(2, '0')} 月`, 'Subtitle'),
      this.docxParagraph(`统计范围：${data.startDate.slice(0, 10)} 至 ${data.endDate.slice(0, 10)}`, 'Subtitle'),
      this.docxParagraph('一、核心指标', 'Heading1'),
      this.docxTable(overview?.headers || ['指标', '数值', '说明'], overview?.rows || []),
      this.docxParagraph('二、占比统计', 'Heading1'),
      this.docxTable(['项目', '数值', '占比条'], visualRows),
      this.docxParagraph('三、故障类型排行', 'Heading1'),
      this.docxTable(fault?.headers || [], fault?.rows || [], 10),
      this.docxParagraph('四、设备故障率与高频设备', 'Heading1'),
      this.docxTable(device?.headers || [], device?.rows || [], 10),
      this.docxParagraph('五、人员绩效', 'Heading1'),
      this.docxTable(engineer?.headers || [], engineer?.rows || [], 10),
      this.docxParagraph('六、维修成本与备件消耗', 'Heading1'),
      this.docxTable(parts?.headers || [], parts?.rows || [], 10),
      this.docxParagraph('七、每日运营走势', 'Heading1'),
      this.docxTable(daily?.headers || [], daily?.rows || [], 12),
      this.docxParagraph('八、运营建议', 'Heading1'),
      this.docxTable(suggestions?.headers || [], suggestions?.rows || [], 8),
      this.docxParagraph('九、低库存预警', 'Heading1'),
      this.docxTable(lowStock?.headers || [], lowStock?.rows || [], 10),
    ]

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          ${partsXml.join('')}
          <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
        </w:body>
      </w:document>`
  }

  private docxStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="21"/></w:rPr></w:style>
        <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="34"/></w:rPr></w:style>
        <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="100"/></w:pPr><w:rPr><w:color w:val="64748B"/><w:sz w:val="21"/></w:rPr></w:style>
        <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="260" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="25"/></w:rPr></w:style>
      </w:styles>`
  }

  async exportMonthlyDocxReport(projectId: string, year: number, month: number) {
    const data = await this.loadMonthlyReportData(projectId, year, month)
    const zip = new JSZip()
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
      </Types>`)
    zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`)
    zip.folder('word')?.file('document.xml', this.buildDocxDocumentXml(data))
    zip.folder('word')?.file('styles.xml', this.docxStylesXml())
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  }

  private resolveChinesePdfFont() {
    const candidates = [
      path.resolve(process.cwd(), 'src/assets/fonts/simhei.ttf'),
      path.resolve(process.cwd(), 'dist/assets/fonts/simhei.ttf'),
      path.resolve(__dirname, '../../assets/fonts/simhei.ttf'),
      path.resolve(__dirname, '../../../src/assets/fonts/simhei.ttf'),
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/arphic/uming.ttc',
    ]

    return candidates.find(candidate => existsSync(candidate))
  }

  async exportMonthlyPdfReport(projectId: string, year: number, month: number) {
    const data = await this.loadMonthlyReportData(projectId, year, month)
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 36 })
        const buffers: Buffer[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => resolve(Buffer.concat(buffers)))

        const fontPath = this.resolveChinesePdfFont()
        if (fontPath) doc.font(fontPath)

        doc.roundedRect(36, 32, doc.page.width - 72, 74, 10).fill('#0F172A')
        doc.fontSize(22).fillColor('#FFFFFF').text('W-Light 项目月度运维报告', 56, 52)
        doc.fontSize(10).fillColor('#BAE6FD').text(`报告期间：${data.year} 年 ${data.month.toString().padStart(2, '0')} 月  |  统计范围：${data.startDate.slice(0, 10)} 至 ${data.endDate.slice(0, 10)}`, 56, 82)
        doc.y = 124

        this.drawPdfKpiCards(doc, data)

        const totalOrders = this.numeric(data.metrics['工单总数'])
        const closedOrders = this.numeric(data.metrics['闭环归档工单'])
        const activeOrders = this.numeric(data.metrics['未闭环工单'])
        const overtimeOrders = this.numeric(data.metrics['超时工单'])

        this.drawPdfSectionTitle(doc, '一、闭环占比统计')
        const ratioRows = [
          ['闭环归档', closedOrders, '#10B981'],
          ['未闭环', activeOrders, '#F59E0B'],
          ['超时', overtimeOrders, '#EF4444'],
        ] as Array<[string, number, string]>
        ratioRows.forEach(([label, value, color]) => {
          const y = doc.y
          const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
          doc.fontSize(10).fillColor('#334155').text(label, doc.page.margins.left, y, { width: 90 })
          doc.roundedRect(doc.page.margins.left + 95, y + 2, width - 170, 10, 5).fill('#EEF2F7')
          doc.roundedRect(doc.page.margins.left + 95, y + 2, Math.max(4, this.ratio(value, totalOrders) / 100 * (width - 170)), 10, 5).fill(color)
          doc.fontSize(10).fillColor('#0F172A').text(`${value} / ${totalOrders}（${this.ratio(value, totalOrders).toFixed(1)}%）`, doc.page.margins.left + width - 70, y - 1, { width: 70, align: 'right' })
          doc.y = y + 26
        })

        this.drawPdfBars(doc, '二、故障类型排行', this.section(data, '故障类型'), '故障类型', '次数', '#EF4444')
        this.drawPdfBars(doc, '三、设备故障率与高频设备', this.section(data, '设备故障率'), '设备名称', '故障次数', '#F97316')
        this.drawPdfBars(doc, '四、维修成本与备件消耗', this.section(data, '维修成本与备件'), '备件名称', '总成本', '#0EA5E9')
        this.drawPdfTable(doc, '五、人员绩效', this.section(data, '人员绩效'), 8)
        this.drawPdfTable(doc, '六、每日运营走势', this.section(data, '每日走势'), 12)
        this.drawPdfTable(doc, '七、运营建议', this.section(data, '运营建议'), 8)
        this.drawPdfTable(doc, '八、低库存预警', this.section(data, '低库存预警'), 8)

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}
