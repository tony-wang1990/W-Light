import { Repository } from 'typeorm'
import { Project, ProjectStatus } from './entities/project.entity'
import { ProjectsService } from './projects.service'

describe('ProjectsService overview', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

  it('combines project records with cross-project operation counts', async () => {
    const project = {
      id: PROJECT_ID,
      name: '凤凰古城夜游灯光项目',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Project
    const query = jest.fn().mockResolvedValue([{
      projectId: PROJECT_ID,
      managerName: '王工',
      deviceCount: '128',
      orderCount: '42',
      openOrderCount: '5',
      overtimeOrderCount: '1',
      partCount: '31',
      lowStockCount: '2',
      inspectionPlanCount: '8',
    }])
    const repo = {
      find: jest.fn().mockResolvedValue([project]),
      manager: {
        connection: { options: { type: 'postgres' } },
        query,
      },
    } as unknown as Repository<Project>
    const service = new ProjectsService(repo)

    const result = await service.findOverview([PROJECT_ID])

    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: expect.anything() },
    }))
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM projects p'), [PROJECT_ID])
    expect(result[0]).toMatchObject({
      id: PROJECT_ID,
      managerName: '王工',
      deviceCount: 128,
      openOrderCount: 5,
      lowStockCount: 2,
      inspectionPlanCount: 8,
    })
  })

  it('does not query the database for an empty authorized project list', async () => {
    const repo = {
      manager: {
        connection: { options: { type: 'postgres' } },
        query: jest.fn(),
      },
    } as unknown as Repository<Project>
    const service = new ProjectsService(repo)

    await expect(service.findOverview([])).resolves.toEqual([])
    expect(repo.manager.query).not.toHaveBeenCalled()
  })
})
