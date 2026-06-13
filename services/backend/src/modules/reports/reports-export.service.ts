import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as ExcelJS from 'exceljs'
import PDFDocument = require('pdfkit')
import { existsSync } from 'fs'
import * as path from 'path'

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
    
    // 计算本月起止时间
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString()
    const prevMonthStartDate = new Date(year, month - 2, 1).toISOString()
    const prevMonthEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999).toISOString()

    // 查询当月数据
    const [currentOrders = {}] = await this.query(
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId" = ? AND "createdAt" BETWEEN ? AND ?`,
      `SELECT COUNT(id) as total, SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed, SUM("repairCost") as cost FROM work_orders WHERE "projectId"::text = $1 AND "createdAt" BETWEEN $2 AND $3`,
      [projectId, startDate, endDate]
    )

    // 查询上月数据用于环比
    const [prevOrders = {}] = await this.query(
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

        const fontPath = this.resolveChinesePdfFont()
        if (fontPath) doc.font(fontPath)

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
