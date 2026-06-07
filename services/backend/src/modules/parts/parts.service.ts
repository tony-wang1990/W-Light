import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { SparePart } from './entities/spare-part.entity'
import { SparePartLog, StockOpType } from './entities/spare-part-log.entity'

export interface PartOutboundResult {
  part: SparePart
  stockAlert: boolean
}

@Injectable()
export class PartsService {
  constructor(
    @InjectRepository(SparePart) private readonly repo: Repository<SparePart>,
    @InjectRepository(SparePartLog) private readonly logRepo: Repository<SparePartLog>,
  ) {}

  create(dto: Partial<SparePart>) {
    return this.repo.save(this.repo.create(dto))
  }

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

  async findOne(id: string, projectId?: string): Promise<SparePart> {
    const part = await this.repo.findOne({ where: projectId ? { id, projectId } : { id } })
    if (!part) throw new NotFoundException('备件不存在')
    return part
  }

  async update(id: string, dto: Partial<SparePart>, projectId?: string): Promise<SparePart> {
    const part = await this.findOne(id, projectId)
    const safeDto = { ...dto } as Partial<SparePart> & { id?: string }
    delete safeDto.projectId
    delete safeDto.id
    return this.repo.save(Object.assign(part, safeDto))
  }

  async remove(id: string, projectId?: string): Promise<{ deleted: true }> {
    const part = await this.findOne(id, projectId)
    await this.repo.remove(part)
    return { deleted: true }
  }

  async inbound(
    partId: string,
    quantity: number,
    operatorId: string,
    note?: string,
    manager?: EntityManager,
    projectId?: string,
  ) {
    const run = async (tx: EntityManager) => {
      const qty = this.normalizeQuantity(quantity)
      const partRepo = tx.getRepository(SparePart)
      const logRepo = tx.getRepository(SparePartLog)
      const params = projectId ? { partId, quantity: qty, projectId } : { partId, quantity: qty }

      const result = await partRepo
        .createQueryBuilder()
        .update(SparePart)
        .set({
          stock: () => 'stock + :quantity',
          updatedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :partId')
        .andWhere(projectId ? '"projectId" = :projectId' : '1 = 1')
        .setParameters(params)
        .execute()

      if (!result.affected) throw new NotFoundException('备件不存在')

      await logRepo.save(logRepo.create({
        partId,
        opType: StockOpType.INBOUND,
        quantity: qty,
        operatorId,
        note,
      }))

      return this.findOneWithManager(partId, tx, projectId)
    }

    return manager ? run(manager) : this.repo.manager.transaction(run)
  }

  async outbound(
    partId: string,
    quantity: number,
    operatorId: string,
    orderId?: string,
    note?: string,
    manager?: EntityManager,
    projectId?: string,
  ): Promise<PartOutboundResult> {
    const run = async (tx: EntityManager) => {
      const qty = this.normalizeQuantity(quantity)
      const partRepo = tx.getRepository(SparePart)
      const logRepo = tx.getRepository(SparePartLog)
      const params = projectId ? { partId, quantity: qty, projectId } : { partId, quantity: qty }

      const result = await partRepo
        .createQueryBuilder()
        .update(SparePart)
        .set({
          stock: () => 'stock - :quantity',
          updatedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :partId')
        .andWhere(projectId ? '"projectId" = :projectId' : '1 = 1')
        .andWhere('stock >= :quantity')
        .setParameters(params)
        .execute()

      if (!result.affected) {
        const current = await partRepo.findOne({ where: projectId ? { id: partId, projectId } : { id: partId } })
        if (!current) throw new NotFoundException('备件不存在')
        throw new BadRequestException(`库存不足，当前库存 ${current.stock} ${current.unit}`)
      }

      await logRepo.save(logRepo.create({
        partId,
        opType: StockOpType.OUTBOUND,
        quantity: qty,
        operatorId,
        orderId,
        note,
      }))

      const part = await this.findOneWithManager(partId, tx, projectId)
      return { part, stockAlert: Number(part.stock) <= Number(part.minStock) }
    }

    return manager ? run(manager) : this.repo.manager.transaction(run)
  }

  async getLogs(partId: string, projectId?: string) {
    await this.findOne(partId, projectId)
    return this.logRepo.find({ where: { partId }, order: { createdAt: 'DESC' } })
  }

  getLowStockAlerts(projectId: string) {
    return this.repo
      .createQueryBuilder('p')
      .where('p."projectId" = :projectId', { projectId })
      .andWhere('p.stock <= p."minStock"')
      .getMany()
  }

  private normalizeQuantity(quantity: number): number {
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('备件数量必须大于 0')
    }
    return qty
  }

  private async findOneWithManager(id: string, manager: EntityManager, projectId?: string): Promise<SparePart> {
    const part = await manager.getRepository(SparePart).findOne({ where: projectId ? { id, projectId } : { id } })
    if (!part) throw new NotFoundException('备件不存在')
    return part
  }
}
