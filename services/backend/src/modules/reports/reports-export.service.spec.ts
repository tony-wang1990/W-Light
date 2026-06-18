/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use minimal workbook and repository fixtures. */

import { DataSource } from 'typeorm'
import * as ExcelJS from 'exceljs'
import JSZip = require('jszip')
import { ReportsExportService } from './reports-export.service'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('ReportsExportService', () => {
  it('exports order rows to an Excel workbook with postgres-safe joins', async () => {
    const ds = {
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([
        {
          orderNo: 'WO-20260607-0001',
          category: 'fault',
          priority: 'P1',
          status: 'closed',
          faultType: 'DMX',
          faultDesc: 'Fixture flickering',
          deviceNo: 'DEV-001',
          deviceName: 'Beam 350',
          location: 'Main Stage',
          reporterName: 'Reporter',
          assigneeName: 'Engineer',
          createdAt: new Date('2026-06-07T01:00:00.000Z'),
          assignedAt: null,
          startedAt: null,
          submittedAt: null,
          closedAt: null,
          isOvertime: false,
          repairCost: '120.50',
        },
      ]),
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)

    const buffer = await service.exportOrdersWorkbook(PROJECT_ID, '2026-06-01', '2026-06-30')

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(ds.query).toHaveBeenCalledTimes(1)
    const [sql, params] = ds.query.mock.calls[0]
    expect(sql).toContain('d.id::text = o."deviceId"::text')
    expect(sql).toContain('reporter.id::text = o."reporterId"::text')
    expect(sql).toContain('assignee.id::text = o."assigneeId"::text')
    expect(sql).toContain('o."projectId"::text = $1')
    expect(params).toEqual([PROJECT_ID, '2026-06-01', '2026-06-30'])

    const workbook = new ExcelJS.Workbook()
    await (workbook.xlsx.load as any)(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.rowCount).toBe(2)
    expect(sheet.getRow(2).getCell(1).value).toBe('WO-20260607-0001')
    expect(sheet.getRow(2).getCell(6).value).toBe('Fixture flickering')
    expect(sheet.getRow(2).getCell(7).value).toBe('DEV-001')
  })

  it('exports engineer performance with postgres assignee joins', async () => {
    const ds = {
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([
        {
          name: 'Engineer',
          role: 'engineer',
          totalAssigned: '2',
          totalClosed: '1',
          overtimeCount: '0',
          totalRepairCost: '80',
          avgRepairHours: '3.5',
        },
      ]),
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)

    const buffer = await service.exportPerformanceWorkbook(PROJECT_ID, '2026-06-01', '2026-06-30')

    expect(Buffer.isBuffer(buffer)).toBe(true)
    const [sql, params] = ds.query.mock.calls[0]
    expect(sql).toContain('o."assigneeId"::text = u.id::text')
    expect(sql).not.toContain('o.id::text = u.id::text')
    expect(params).toEqual([PROJECT_ID, '2026-06-01', '2026-06-30'])
  })

  it('generates every download-center export without postgres boolean SQL mistakes', async () => {
    const ds = {
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)
    const startDate = '2026-06-01'
    const endDate = '2026-06-30'

    const exportsToCheck: Array<() => Promise<Buffer>> = [
      () => service.exportOrdersWorkbook(PROJECT_ID, startDate, endDate),
      () => service.exportDeviceInventoryWorkbook(PROJECT_ID),
      () => service.exportPartsInventoryWorkbook(PROJECT_ID),
      () => service.exportPartsConsumptionWorkbook(PROJECT_ID, startDate, endDate),
      () => service.exportPerformanceWorkbook(PROJECT_ID, startDate, endDate),
      () => service.exportFaultStatsWorkbook(PROJECT_ID, startDate, endDate),
      () => service.exportFinancialConsumption(PROJECT_ID, startDate, endDate),
      () => service.exportDeviceReliability(PROJECT_ID, startDate, endDate),
      () => service.exportLocationHeatmap(PROJECT_ID, startDate, endDate),
      () => service.exportDailyKpi(PROJECT_ID, startDate, endDate),
      () => service.exportInspectionAnomaly(PROJECT_ID, startDate, endDate),
      () => service.exportMonthlyOperationsWorkbook(PROJECT_ID, startDate, endDate),
    ]

    for (const exportTask of exportsToCheck) {
      await expect(exportTask()).resolves.toEqual(expect.any(Buffer))
    }

    const executedSql = ds.query.mock.calls.map(([sql]) => String(sql)).join('\n')
    expect(executedSql).not.toContain('"isOvertime" = 1')
    expect(executedSql).not.toContain('p.category')
  })

  it('generates the monthly PDF report even when aggregate queries return empty rows', async () => {
    const ds = {
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)

    await expect(service.exportMonthlyPdfReport(PROJECT_ID, 2026, 6)).resolves.toEqual(expect.any(Buffer))
  })

  it('includes project context, management summary and risks in the monthly workbook', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{
        name: '凤凰文旅灯光项目',
        venue: '凤凰广场',
        address: '测试路 1 号',
        status: 'active',
      }])
      .mockResolvedValue([])
    const ds = {
      options: { type: 'postgres' },
      query,
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)

    const buffer = await service.exportMonthlyOperationsWorkbook(PROJECT_ID, '2026-06-01', '2026-06-30')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(expect.arrayContaining([
      '项目概况',
      '管理摘要',
      '核心指标',
      '风险清单',
      '运营建议',
    ]))
    expect(workbook.getWorksheet('项目概况')?.getCell('B2').text).toBe('凤凰文旅灯光项目')
  })

  it('generates the monthly DOCX report from the same monthly workbook data', async () => {
    const ds = {
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>
    const service = new ReportsExportService(ds)

    const buffer = await service.exportMonthlyDocxReport(PROJECT_ID, 2026, 6)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const zip = await JSZip.loadAsync(buffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')
    expect(documentXml).toContain('项目概况')
    expect(documentXml).toContain('管理摘要')
    expect(documentXml).toContain('风险清单')
  })
})
