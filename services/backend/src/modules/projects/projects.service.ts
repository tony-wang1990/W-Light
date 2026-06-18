import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Project } from './entities/project.entity'

export interface ProjectOverview extends Project {
  managerName?: string
  deviceCount: number
  orderCount: number
  openOrderCount: number
  overtimeOrderCount: number
  partCount: number
  lowStockCount: number
  inspectionPlanCount: number
}

@Injectable()
export class ProjectsService {
  constructor(@InjectRepository(Project) private readonly repo: Repository<Project>) {}

  create(dto: Partial<Project>) { return this.repo.save(this.repo.create(dto)) }

  findAll(projectIds?: string[]) {
    if (projectIds && projectIds.length === 0) return []
    return this.repo.find({
      where: projectIds ? { id: In(projectIds) } : undefined,
      order: { createdAt: 'DESC' },
    })
  }

  async findOverview(projectIds?: string[]): Promise<ProjectOverview[]> {
    if (projectIds && projectIds.length === 0) return []
    const projects = await this.findAll(projectIds)
    if (projects.length === 0) return []

    const ids = projects.map(project => project.id)
    const placeholders = ids.map((_, index) => this.repo.manager.connection.options.type === 'postgres' ? `$${index + 1}` : '?')
    const idFilter = placeholders.join(', ')
    const isPostgres = this.repo.manager.connection.options.type === 'postgres'
    const textColumn = (value: string) => isPostgres ? `${value}::text` : `CAST(${value} AS text)`
    const sql = `
      SELECT
        ${textColumn('p.id')} AS "projectId",
        COALESCE(u.name, '') AS "managerName",
        (SELECT COUNT(*) FROM devices d WHERE ${textColumn('d."projectId"')} = ${textColumn('p.id')}) AS "deviceCount",
        (SELECT COUNT(*) FROM work_orders o WHERE ${textColumn('o."projectId"')} = ${textColumn('p.id')}) AS "orderCount",
        (SELECT COUNT(*) FROM work_orders o WHERE ${textColumn('o."projectId"')} = ${textColumn('p.id')} AND o.status IN ('pending', 'assigned', 'processing', 'reviewing', 'suspended')) AS "openOrderCount",
        (SELECT COUNT(*) FROM work_orders o WHERE ${textColumn('o."projectId"')} = ${textColumn('p.id')} AND ${isPostgres ? 'o."isOvertime" = true' : '(o."isOvertime" = 1 OR o."isOvertime" = \'true\')'}) AS "overtimeOrderCount",
        (SELECT COUNT(*) FROM spare_parts sp WHERE ${textColumn('sp."projectId"')} = ${textColumn('p.id')}) AS "partCount",
        (SELECT COUNT(*) FROM spare_parts sp WHERE ${textColumn('sp."projectId"')} = ${textColumn('p.id')} AND sp.stock <= sp."minStock") AS "lowStockCount",
        (SELECT COUNT(*) FROM inspection_plans ip WHERE ${textColumn('ip."projectId"')} = ${textColumn('p.id')} AND ip."isActive" = 1) AS "inspectionPlanCount"
      FROM projects p
      LEFT JOIN users u ON ${textColumn('u.id')} = ${textColumn('p."managerId"')}
      WHERE p.id IN (${idFilter})
    `
    const rows = await this.repo.manager.query(sql, ids) as Array<Record<string, unknown>>
    const stats = new Map(rows.map(row => [String(row.projectId), row]))

    return projects.map(project => {
      const row = stats.get(project.id) || {}
      return Object.assign(project, {
        managerName: String(row.managerName || ''),
        deviceCount: Number(row.deviceCount || 0),
        orderCount: Number(row.orderCount || 0),
        openOrderCount: Number(row.openOrderCount || 0),
        overtimeOrderCount: Number(row.overtimeOrderCount || 0),
        partCount: Number(row.partCount || 0),
        lowStockCount: Number(row.lowStockCount || 0),
        inspectionPlanCount: Number(row.inspectionPlanCount || 0),
      })
    })
  }

  async findOne(id: string): Promise<Project> {
    const p = await this.repo.findOne({ where: { id } })
    if (!p) throw new NotFoundException('项目不存在')
    return p
  }

  async update(id: string, dto: Partial<Project>): Promise<Project> {
    const p = await this.findOne(id)
    return this.repo.save(Object.assign(p, dto))
  }
}
