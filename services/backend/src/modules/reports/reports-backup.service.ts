import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, In } from 'typeorm'
import { Device } from '../devices/entities/device.entity'
import { WorkOrder } from '../orders/entities/order.entity'
import { RepairLog } from '../orders/entities/repair-log.entity'
import { SparePart } from '../parts/entities/spare-part.entity'
import { SparePartLog } from '../parts/entities/spare-part-log.entity'
import { InspectionPlan } from '../inspections/entities/inspection-plan.entity'
import { InspectionRecord } from '../inspections/entities/inspection-record.entity'
import { Project } from '../projects/entities/project.entity'
import { User } from '../users/entities/user.entity'

type BackupRow = Record<string, any>
type BackupTables = Record<string, BackupRow[] | undefined>

interface BackupPayload {
  version?: number
  projectId?: string
  tables?: BackupTables
  attachments?: BackupRow[]
}

const tableLabels: Record<string, string> = {
  users: 'users',
  project: 'project',
  devices: 'devices',
  workOrders: 'workOrders',
  repairLogs: 'repairLogs',
  spareParts: 'spareParts',
  sparePartLogs: 'sparePartLogs',
  inspectionPlans: 'inspectionPlans',
  inspectionRecords: 'inspectionRecords',
}

function ensureArray(value: unknown): BackupRow[] {
  return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as BackupRow[] : []
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeJsonFields(row: BackupRow, fields: string[]) {
  const normalized = { ...row }
  fields.forEach(field => {
    normalized[field] = parseJsonArray(normalized[field])
  })
  return normalized
}

function rowsWithId(rows: BackupRow[]) {
  return rows.filter(row => typeof row.id === 'string' && row.id.trim().length > 0)
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function makeUniqueValue(base: string, usedValues: Set<string>, maxLength: number) {
  const fallback = `RESTORE-${Date.now()}`
  const normalizedBase = String(base || fallback).trim() || fallback
  const clippedBase = normalizedBase.slice(0, maxLength)
  if (!usedValues.has(clippedBase)) return clippedBase

  for (let i = 1; i <= 999; i += 1) {
    const suffix = `-R${i}`
    const candidate = `${clippedBase.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`
    if (!usedValues.has(candidate)) return candidate
  }

  const randomSuffix = `-${Math.random().toString(36).slice(2, 8)}`
  return `${clippedBase.slice(0, Math.max(1, maxLength - randomSuffix.length))}${randomSuffix}`
}

@Injectable()
export class ReportsBackupService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private unwrapBackupPayload(payload: unknown): BackupPayload {
    const candidate = (payload as { backup?: unknown })?.backup || payload
    if (!candidate || typeof candidate !== 'object') {
      throw new BadRequestException('备份文件格式不正确')
    }

    const backup = candidate as BackupPayload
    if (!backup.tables || typeof backup.tables !== 'object') {
      throw new BadRequestException('备份文件缺少 tables 数据')
    }

    return backup
  }

  private projectRows(rows: BackupRow[], projectId: string, jsonFields: string[] = []): BackupRow[] {
    return rowsWithId(rows).map(row => ({
      ...normalizeJsonFields(row, jsonFields),
      projectId,
    }))
  }

  private normalizeUsers(rows: BackupRow[], sourceProjectId: string | undefined, targetProjectId: string) {
    return rowsWithId(rows).map(row => {
      const projectIds = parseJsonArray(row.projectIds)
        .map(item => String(item))
        .filter(Boolean)
        .map(item => sourceProjectId && item === sourceProjectId ? targetProjectId : item)
      if (!projectIds.includes(targetProjectId)) projectIds.push(targetProjectId)

      return {
        ...normalizeJsonFields(row, ['skillTags']),
        projectIds,
      }
    })
  }

  private async resolveUserConflicts(
    rows: BackupRow[],
    targetProjectId: string,
    warnings: string[],
  ): Promise<{ users: BackupRow[]; userIdMap: Map<string, string> }> {
    const phones = uniqueStrings(rows.map(row => row.phone))
    const existingUsers = phones.length
      ? await this.ds.getRepository(User).find({ where: { phone: In(phones) } })
      : []
    const existingByPhone = new Map(existingUsers.map(user => [user.phone, user]))
    const users: BackupRow[] = []
    const userIdMap = new Map<string, string>()
    const addedUserIds = new Set<string>()

    for (const row of rows) {
      const phone = String(row.phone || '').trim()
      const existing = phone ? existingByPhone.get(phone) : null

      if (existing && existing.id !== row.id) {
        userIdMap.set(row.id, existing.id)
        const projectIds = parseJsonArray(existing.projectIds)
          .map(item => String(item))
          .filter(Boolean)
        if (!projectIds.includes(targetProjectId)) projectIds.push(targetProjectId)
        if (!addedUserIds.has(existing.id)) {
          users.push({ ...existing, projectIds })
          addedUserIds.add(existing.id)
        }
        warnings.push(`手机号 ${phone} 已存在，备份用户 ${row.name || row.id} 已映射到现有账号 ${existing.name || existing.id}`)
        continue
      }

      if (!addedUserIds.has(row.id)) {
        users.push(row)
        addedUserIds.add(row.id)
      }
    }

    return { users, userIdMap }
  }

  private async resolveDeviceConflicts(rows: BackupRow[], targetProjectId: string, warnings: string[]): Promise<BackupRow[]> {
    const deviceRepo = this.ds.getRepository(Device)
    const existingDevices = await deviceRepo.find({
      where: { projectId: targetProjectId },
      select: ['id', 'deviceNo', 'qrCode'] as any,
    })
    const existingByNo = new Map(existingDevices.map(device => [device.deviceNo, device]))
    const existingByQr = new Map(existingDevices.map(device => [device.qrCode, device]))
    const usedDeviceNos = new Set(existingDevices.map(device => device.deviceNo))
    const usedQrCodes = new Set(existingDevices.map(device => device.qrCode))
    const seenDeviceNos = new Set<string>()
    const seenQrCodes = new Set<string>()

    return rows.map(row => {
      const originalDeviceNo = String(row.deviceNo || row.id).trim()
      const originalQrCode = String(row.qrCode || originalDeviceNo).trim()
      const deviceNoOwner = existingByNo.get(originalDeviceNo)
      const qrCodeOwner = existingByQr.get(originalQrCode)
      const hasDeviceNoConflict = seenDeviceNos.has(originalDeviceNo) || (!!deviceNoOwner && deviceNoOwner.id !== row.id)
      const hasQrCodeConflict = seenQrCodes.has(originalQrCode) || (!!qrCodeOwner && qrCodeOwner.id !== row.id)

      if (!hasDeviceNoConflict && !hasQrCodeConflict) {
        usedDeviceNos.add(originalDeviceNo)
        usedQrCodes.add(originalQrCode)
        seenDeviceNos.add(originalDeviceNo)
        seenQrCodes.add(originalQrCode)
        return { ...row, deviceNo: originalDeviceNo, qrCode: originalQrCode }
      }

      const deviceNo = makeUniqueValue(originalDeviceNo, usedDeviceNos, 50)
      usedDeviceNos.add(deviceNo)
      seenDeviceNos.add(deviceNo)
      const qrCode = makeUniqueValue(originalQrCode || deviceNo, usedQrCodes, 100)
      usedQrCodes.add(qrCode)
      seenQrCodes.add(qrCode)
      warnings.push(`设备 ${originalDeviceNo || row.id} 的编号或二维码冲突，已导入为 ${deviceNo} / ${qrCode}`)
      return { ...row, deviceNo, qrCode }
    })
  }

  private mapUserId(value: unknown, userIdMap: Map<string, string>): any {
    if (typeof value !== 'string') return value
    return userIdMap.get(value) || value
  }

  private async idsForProject(entity: any, projectId: string): Promise<string[]> {
    const rows = await this.ds.getRepository(entity).find({
      where: { projectId },
      select: ['id'] as any,
    })
    return rows.map(row => row.id).filter(Boolean)
  }

  private restoreCount(received: number, accepted: number) {
    return { received, accepted, skipped: Math.max(0, received - accepted) }
  }

  private extractProjectObjectName(projectId: string, value: unknown): string | null {
    if (typeof value !== 'string') return null
    const marker = `projects/${projectId}/`
    const index = value.indexOf(marker)
    if (index < 0) return null
    return value.slice(index)
  }

  private collectAttachmentReferences(
    projectId: string,
    orders: WorkOrder[],
    repairLogs: RepairLog[],
    inspectionRecords: InspectionRecord[],
  ) {
    const attachments: BackupRow[] = []
    const addUrl = (sourceType: string, sourceId: string, field: string, url: unknown) => {
      const objectName = this.extractProjectObjectName(projectId, url)
      if (!objectName) return
      attachments.push({
        sourceType,
        sourceId,
        field,
        url,
        objectName,
      })
    }

    orders.forEach(order => parseJsonArray(order.mediaUrls).forEach(url => addUrl('workOrder', order.id, 'mediaUrls', url)))
    repairLogs.forEach(log => parseJsonArray(log.photoUrls).forEach(url => addUrl('repairLog', log.id, 'photoUrls', url)))
    inspectionRecords.forEach(record => parseJsonArray(record.photoUrls).forEach(url => addUrl('inspectionRecord', record.id, 'photoUrls', url)))
    return attachments
  }

  async backupProjectData(projectId: string) {
    const userRepo = this.ds.getRepository(User)
    const deviceRepo = this.ds.getRepository(Device)
    const orderRepo = this.ds.getRepository(WorkOrder)
    const repairLogRepo = this.ds.getRepository(RepairLog)
    const partRepo = this.ds.getRepository(SparePart)
    const partLogRepo = this.ds.getRepository(SparePartLog)
    const inspectionPlanRepo = this.ds.getRepository(InspectionPlan)
    const inspectionRecordRepo = this.ds.getRepository(InspectionRecord)

    const [
      project,
      users,
      devices,
      orders,
      parts,
      inspectionPlans,
    ] = await Promise.all([
      this.ds.getRepository(Project).findOne({ where: { id: projectId } }),
      userRepo.find().then(items => items.filter(user => parseJsonArray(user.projectIds).includes(projectId))),
      deviceRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      orderRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      partRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
      inspectionPlanRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any }),
    ])

    const orderIds = orders.map(order => order.id).filter(Boolean)
    const partIds = parts.map(part => part.id).filter(Boolean)
    const planIds = inspectionPlans.map(plan => plan.id).filter(Boolean)

    const [
      repairLogs,
      partLogs,
      inspectionRecords,
    ] = await Promise.all([
      orderIds.length
        ? repairLogRepo.find({ where: { orderId: In(orderIds) }, order: { loggedAt: 'DESC' } as any })
        : Promise.resolve([]),
      partIds.length
        ? partLogRepo.find({ where: { partId: In(partIds) }, order: { createdAt: 'DESC' } as any })
        : Promise.resolve([]),
      planIds.length
        ? inspectionRecordRepo.find({ where: { planId: In(planIds) }, order: { inspectedAt: 'DESC' } as any })
        : Promise.resolve([]),
    ])

    return {
      version: 1,
      projectId,
      exportedAt: new Date().toISOString(),
      attachments: this.collectAttachmentReferences(projectId, orders, repairLogs, inspectionRecords),
      tables: {
        project: project ? [project] : [],
        users,
        devices,
        workOrders: orders,
        repairLogs,
        spareParts: parts,
        sparePartLogs: partLogs,
        inspectionPlans,
        inspectionRecords,
      },
    }
  }

  async restoreProjectData(projectId: string, payload: unknown, dryRun = false) {
    const backup = this.unwrapBackupPayload(payload)
    const tables = backup.tables || {}
    const warnings: string[] = []

    const normalizedUsers = this.normalizeUsers(ensureArray(tables.users), backup.projectId, projectId)
    const { users, userIdMap } = await this.resolveUserConflicts(normalizedUsers, projectId, warnings)
    const project = ensureArray(tables.project)
      .slice(0, 1)
      .map(row => ({ ...row, id: projectId }))

    const devices = await this.resolveDeviceConflicts(this.projectRows(ensureArray(tables.devices), projectId), projectId, warnings)
    const workOrders: BackupRow[] = this.projectRows(ensureArray(tables.workOrders), projectId, ['mediaUrls'])
      .map(row => ({
        ...row,
        reporterId: this.mapUserId(row.reporterId, userIdMap),
        assigneeId: this.mapUserId(row.assigneeId, userIdMap),
      }))
    const spareParts = this.projectRows(ensureArray(tables.spareParts), projectId)
    const inspectionPlans: BackupRow[] = this.projectRows(ensureArray(tables.inspectionPlans), projectId, ['deviceIds'])
      .map(row => ({
        ...row,
        assigneeId: this.mapUserId(row.assigneeId, userIdMap),
      }))

    const currentOrderIds = await this.idsForProject(WorkOrder, projectId)
    const currentPartIds = await this.idsForProject(SparePart, projectId)
    const currentPlanIds = await this.idsForProject(InspectionPlan, projectId)
    const orderIds = new Set([...currentOrderIds, ...workOrders.map(row => row.id)])
    const partIds = new Set([...currentPartIds, ...spareParts.map(row => row.id)])
    const planIds = new Set([...currentPlanIds, ...inspectionPlans.map(row => row.id)])

    const rawRepairLogs = rowsWithId(ensureArray(tables.repairLogs))
    const repairLogs = rawRepairLogs
      .filter(row => orderIds.has(row.orderId))
      .map(row => normalizeJsonFields({
        ...row,
        engineerId: this.mapUserId(row.engineerId, userIdMap),
      }, ['photoUrls', 'partUsages']))

    const rawPartLogs = rowsWithId(ensureArray(tables.sparePartLogs))
    const sparePartLogs: BackupRow[] = rawPartLogs
      .filter(row => partIds.has(row.partId))
      .map(row => ({
        ...row,
        operatorId: this.mapUserId(row.operatorId, userIdMap),
      }))

    const rawInspectionRecords = rowsWithId(ensureArray(tables.inspectionRecords))
    const inspectionRecords = rawInspectionRecords
      .filter(row => planIds.has(row.planId))
      .map(row => normalizeJsonFields({
        ...row,
        inspectorId: this.mapUserId(row.inspectorId, userIdMap),
      }, ['photoUrls']))

    if (rawRepairLogs.length !== repairLogs.length) {
      warnings.push(`跳过 ${rawRepairLogs.length - repairLogs.length} 条未匹配当前项目工单的维修记录`)
    }
    if (rawPartLogs.length !== sparePartLogs.length) {
      warnings.push(`跳过 ${rawPartLogs.length - sparePartLogs.length} 条未匹配当前项目备件的库存流水`)
    }
    if (rawInspectionRecords.length !== inspectionRecords.length) {
      warnings.push(`跳过 ${rawInspectionRecords.length - inspectionRecords.length} 条未匹配当前项目巡检计划的巡检记录`)
    }

    const result = {
      dryRun,
      version: backup.version || 1,
      sourceProjectId: backup.projectId,
      targetProjectId: projectId,
      restoredAt: dryRun ? undefined : new Date().toISOString(),
      warnings,
      tables: {
        [tableLabels.users]: this.restoreCount(ensureArray(tables.users).length, users.length),
        [tableLabels.project]: this.restoreCount(ensureArray(tables.project).length, project.length),
        [tableLabels.devices]: this.restoreCount(ensureArray(tables.devices).length, devices.length),
        [tableLabels.workOrders]: this.restoreCount(ensureArray(tables.workOrders).length, workOrders.length),
        [tableLabels.repairLogs]: this.restoreCount(rawRepairLogs.length, repairLogs.length),
        [tableLabels.spareParts]: this.restoreCount(ensureArray(tables.spareParts).length, spareParts.length),
        [tableLabels.sparePartLogs]: this.restoreCount(rawPartLogs.length, sparePartLogs.length),
        [tableLabels.inspectionPlans]: this.restoreCount(ensureArray(tables.inspectionPlans).length, inspectionPlans.length),
        [tableLabels.inspectionRecords]: this.restoreCount(rawInspectionRecords.length, inspectionRecords.length),
      },
    }

    if (dryRun) return result

    await this.ds.transaction(async manager => {
      if (users.length) await manager.getRepository(User).save(users, { chunk: 50 })
      if (project.length) await manager.getRepository(Project).save(project, { chunk: 50 })
      if (devices.length) await manager.getRepository(Device).save(devices, { chunk: 50 })
      if (spareParts.length) await manager.getRepository(SparePart).save(spareParts, { chunk: 50 })
      if (inspectionPlans.length) await manager.getRepository(InspectionPlan).save(inspectionPlans, { chunk: 50 })
      if (workOrders.length) await manager.getRepository(WorkOrder).save(workOrders, { chunk: 50 })
      if (repairLogs.length) await manager.getRepository(RepairLog).save(repairLogs, { chunk: 50 })
      if (sparePartLogs.length) await manager.getRepository(SparePartLog).save(sparePartLogs, { chunk: 50 })
      if (inspectionRecords.length) await manager.getRepository(InspectionRecord).save(inspectionRecords, { chunk: 50 })
    })

    return result
  }
}
