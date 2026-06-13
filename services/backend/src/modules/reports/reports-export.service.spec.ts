/* eslint-disable @typescript-eslint/no-explicit-any -- Tests use minimal workbook and repository fixtures. */

import { DataSource } from 'typeorm'
import * as ExcelJS from 'exceljs'
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
})
