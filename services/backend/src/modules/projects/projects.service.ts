import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Project } from './entities/project.entity'

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
