import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device, DeviceStatus } from './entities/device.entity'

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
    return qb.orderBy('d."deviceNo"').getMany()
  }

  async findOne(id: string): Promise<Device> {
    const d = await this.repo.findOne({ where: { id } })
    if (!d) throw new NotFoundException('设备不存在')
    return d
  }

  async findByQrCode(qrCode: string): Promise<Device> {
    const d = await this.repo.findOne({
      where: [
        { qrCode },
        { deviceNo: qrCode },
      ],
    })
    if (!d) throw new NotFoundException('未找到对应设备，请检查二维码')
    return d
  }

  async update(id: string, dto: Partial<Device>): Promise<Device> {
    const d = await this.findOne(id)
    return this.repo.save(Object.assign(d, dto))
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const d = await this.findOne(id)
    await this.repo.remove(d)
    return { deleted: true }
  }

  /** 更新设备健康分 */
  async updateHealthScore(id: string, score: number): Promise<void> {
    await this.repo.update(id, { healthScore: Math.max(0, Math.min(100, score)) })
  }

  /** 扫码报修快速入口 */
  async getDeviceForOrder(qrCode: string) {
    const device = await this.findByQrCode(qrCode)
    return { device, hint: `已识别设备: ${device.name} (${device.deviceNo})` }
  }

  async batchImport(devices: Partial<Device>[], projectId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = []
    let imported = 0
    for (const d of devices) {
      try {
        await this.repo.save(this.repo.create(this.normalizeDevice({ ...d, projectId: d.projectId || projectId })))
        imported++
      } catch (e) {
        errors.push(`${d.deviceNo}: ${e.message}`)
      }
    }
    return { imported, errors }
  }
}
