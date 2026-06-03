import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UserRole } from './entities/user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

function assertProjectAccess(req: any, projectId?: string) {
  if (!projectId || req.user.role === UserRole.ADMIN) return
  if (!Array.isArray(req.user.projectIds) || !req.user.projectIds.includes(projectId)) {
    throw new ForbiddenException('No access to this project')
  }
}

@ApiTags('用户管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建用户（管理员）' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'includeWorkload', required: false, type: Boolean })
  findAll(
    @Request() req,
    @Query('projectId') projectId?: string,
    @Query('includeWorkload') includeWorkload?: string,
  ) {
    const scopedProjectId = projectId || (req.headers['x-project-id'] as string | undefined)
    assertProjectAccess(req, scopedProjectId)
    return this.usersService.findAll(scopedProjectId, includeWorkload === 'true' || includeWorkload === '1', req.user)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role !== UserRole.ADMIN && req.user.id !== id) {
      throw new ForbiddenException('No access to this user')
    }
    return this.usersService.findOne(id)
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新用户信息' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '禁用用户' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id)
  }
}
