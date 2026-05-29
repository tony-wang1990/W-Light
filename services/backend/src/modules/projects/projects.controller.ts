import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ProjectsService } from './projects.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Project } from './entities/project.entity'

@ApiTags('项目管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() dto: Partial<Project>) { return this.svc.create(dto) }

  @Get()
  @ApiOperation({ summary: '获取项目列表' })
  findAll() { return this.svc.findAll() }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Put(':id')
  @ApiOperation({ summary: '更新项目' })
  update(@Param('id') id: string, @Body() dto: Partial<Project>) { return this.svc.update(id, dto) }
}
