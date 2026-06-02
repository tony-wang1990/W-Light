import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SparePart } from './entities/spare-part.entity'
import { SparePartLog, StockOpType } from './entities/spare-part-log.entity'

@Injectable()
export class PartsService {
  constructor(
    @InjectRepository(SparePart) private readonly repo: Repository<SparePart>,
    @InjectRepository(SparePartLog) private readonly logRepo: Repository<SparePartLog>,
  ) {}

  create(dto: Partial<SparePart>) { return this.repo.save(this.repo.create(dto)) }

  findAll(projectId: string, lowStockOnly = false, keyword?: string) {
    const qb = this.repo.createQueryBuilder('p').where('p."projectId" = :projectId', { projectId })
    if (lowStockOnly) qb.andWhere('p.stock <= p."minStock"')
    if (keyword?.trim()) {
      qb.andWhere(
        `(
          LOWER(p.name) LIKE :kw OR
          LOWER(COALESCE(p.model, '')) LIKE :kw OR
          LOWER(COALESCE(p.supplier, '')) LIKE :kw
        )`,
        { kw: `%${keyword.trim().toLowerCase()}%` },
      )
    }
    return qb.orderBy('p.name').getMany()
  }

  async findOne(id: string): Promise<SparePart> {
    const p = await this.repo.findOne({ where: { id } })
    if (!p) throw new NotFoundException('备件不存在')
    return p
  }

  async update(id: string, dto: Partial<SparePart>): Promise<SparePart> {
    const p = await this.findOne(id)
    return this.repo.save(Object.assign(p, dto))
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const p = await this.findOne(id)
    await this.repo.remove(p)
    return { deleted: true }
  }

  async inbound(partId: string, quantity: number, operatorId: string, note?: string) {
    const part = await this.findOne(partId)
    part.stock = Number(part.stock) + quantity
    await this.repo.save(part)
    await this.logRepo.save(this.logRepo.create({ partId, opType: StockOpType.INBOUND, quantity, operatorId, note }))
    return part
  }

  async outbound(partId: string, quantity: number, operatorId: string, orderId?: string, note?: string) {
    const part = await this.findOne(partId)
    if (Number(part.stock) < quantity) {
      throw new BadRequestException(`库存不足，当前库存 ${part.stock} ${part.unit}`)
    }
    part.stock = Number(part.stock) - quantity
    await this.repo.save(part)
    await this.logRepo.save(this.logRepo.create({ partId, opType: StockOpType.OUTBOUND, quantity, operatorId, orderId, note }))
    // 低库存预警
    const isLow = Number(part.stock) <= Number(part.minStock)
    return { part, stockAlert: isLow }
  }

  getLogs(partId: string) {
    return this.logRepo.find({ where: { partId }, order: { createdAt: 'DESC' } })
  }

  getLowStockAlerts(projectId: string) {
    return this.repo
      .createQueryBuilder('p')
      .where('p."projectId" = :projectId', { projectId })
      .andWhere('p.stock <= p."minStock"')
      .getMany()
  }
}
