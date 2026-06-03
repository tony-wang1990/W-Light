import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UserRole } from '../users/entities/user.entity'
import { ProjectsService } from './projects.service'
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto'

function assertProjectAccess(req: any, projectId: string) {
  if (req.user.role === UserRole.ADMIN) return
  if (!Array.isArray(req.user.projectIds) || !req.user.projectIds.includes(projectId)) {
    throw new ForbiddenException('No access to this project')
  }
}

@ApiTags('项目管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建项目' })
  create(@Body() dto: CreateProjectDto) {
    return this.svc.create(dto)
  }

  @Get()
  @ApiOperation({ summary: '获取项目列表' })
  findAll(@Request() req) {
    return this.svc.findAll(req.user.role === UserRole.ADMIN ? undefined : req.user.projectIds)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(@Param('id') id: string, @Request() req) {
    assertProjectAccess(req, id)
    return this.svc.findOne(id)
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新项目' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.svc.update(id, dto)
  }
}
