import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from './entities/device.entity'

export interface PublicDeviceInfo {
  deviceNo: string
  name: string
  category?: string
  location?: string
  status: string
  healthScore?: number
  manufacturer?: string
  model?: string
  warrantyExpire?: string
}

@Injectable()
export class DevicesService {
  constructor(@InjectRepository(Device) private readonly repo: Repository<Device>) {}

  private normalizeDevice(dto: Partial<Device>) {
    const normalized = { ...dto }
    if (!normalized.qrCode) {
      normalized.qrCode = normalized.deviceNo || `DEV-${Date.now()}`
    }
    return normalized
  }

  create(dto: Partial<Device>) {
    return this.repo.save(this.repo.create(this.normalizeDevice(dto)))
  }

  findAll(projectId: string, category?: string, status?: string, keyword?: string) {
    const qb = this.repo.createQueryBuilder('d').where('d."projectId" = :projectId', { projectId })
    if (category) qb.andWhere('d.category = :category', { category })
    if (status) qb.andWhere('d.status = :status', { status })
    if (keyword?.trim()) {
      qb.andWhere(
        `(
          LOWER(d."deviceNo") LIKE :kw OR
          LOWER(d.name) LIKE :kw OR
          LOWER(COALESCE(d.model, '')) LIKE :kw OR
          LOWER(COALESCE(d.manufacturer, '')) LIKE :kw OR
          LOWER(COALESCE(d.location, '')) LIKE :kw OR
          LOWER(d."qrCode") LIKE :kw
        )`,
        { kw: `%${keyword.trim().toLowerCase()}%` },
      )
    }
    return qb.orderBy('d.deviceNo').getMany()
  }

  async findOne(id: string, projectId?: string): Promise<Device> {
    const d = await this.repo.findOne({ where: projectId ? { id, projectId } : { id } })
    if (!d) throw new NotFoundException('设备不存在')
    return d
  }

  async findByQrCode(qrCode: string, projectId?: string): Promise<Device> {
    const d = await this.repo.findOne({
      where: projectId
        ? [
          { qrCode, projectId },
          { deviceNo: qrCode, projectId },
        ]
        : [
          { qrCode },
          { deviceNo: qrCode },
        ],
    })
    if (!d) throw new NotFoundException('未找到对应设备，请检查二维码')
    return d
  }

  async findPublicByQrCode(qrCode: string): Promise<PublicDeviceInfo> {
    const device = await this.findByQrCode(qrCode)
    return {
      deviceNo: device.deviceNo,
      name: device.name,
      category: device.category,
      location: device.location,
      status: device.status,
      healthScore: device.healthScore == null ? undefined : Number(device.healthScore),
      manufacturer: device.manufacturer,
      model: device.model,
      warrantyExpire: device.warrantyExpire,
    }
  }

  async update(id: string, dto: Partial<Device>, projectId?: string): Promise<Device> {
    const d = await this.findOne(id, projectId)
    const safeDto = { ...dto } as Partial<Device> & { id?: string }
    delete safeDto.projectId
    delete safeDto.id
    return this.repo.save(Object.assign(d, safeDto))
  }

  async remove(id: string, projectId?: string): Promise<{ deleted: true }> {
    const d = await this.findOne(id, projectId)
    await this.repo.remove(d)
    return { deleted: true }
  }

  async updateHealthScore(id: string, score: number): Promise<void> {
    await this.repo.update(id, { healthScore: Math.max(0, Math.min(100, score)) })
  }

  async getDeviceForOrder(qrCode: string, projectId?: string) {
    const device = await this.findByQrCode(qrCode, projectId)
    return { device, hint: `已识别设备 ${device.name} (${device.deviceNo})` }
  }

  async batchImport(devices: Partial<Device>[], projectId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = []
    let imported = 0
    for (const d of devices) {
      try {
        await this.repo.save(this.repo.create(this.normalizeDevice({ ...d, projectId })))
        imported += 1
      } catch (e) {
        errors.push(`${d.deviceNo}: ${e.message}`)
      }
    }
    return { imported, errors }
  }
}
