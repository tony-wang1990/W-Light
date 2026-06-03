import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ProjectAccessGuard } from '../../common/guards/project-access.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UserRole } from '../users/entities/user.entity'
import { InspectionsService } from './inspections.service'
import { CreateInspectionPlanDto, UpdateInspectionPlanDto } from './dto/inspection-plan.dto'
import { CreateInspectionRecordDto } from './dto/inspection-record.dto'

@ApiTags('巡检管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly svc: InspectionsService) {}

  @Post('plans')
  @Roles(UserRole.ADMIN)
  createPlan(@Body() dto: CreateInspectionPlanDto, @Request() req) {
    return this.svc.createPlan({ ...dto, projectId: req.projectId })
  }

  @Get('plans')
  getPlans(@Request() req) {
    return this.svc.getPlans(req.projectId)
  }

  @Put('plans/:id')
  @Roles(UserRole.ADMIN)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateInspectionPlanDto, @Request() req) {
    return this.svc.updatePlan(id, dto, req.projectId)
  }

  @Get('today')
  getTodayPlans(@Request() req) {
    return this.svc.getTodayPlans(req.user.id, req.projectId)
  }

  @Post('records')
  @Roles(UserRole.ADMIN, UserRole.ENGINEER, UserRole.INSPECTOR)
  createRecord(@Body() dto: CreateInspectionRecordDto, @Request() req) {
    return this.svc.createRecord(dto, req.user.id, req.projectId)
  }

  @Get('records')
  getRecords(
    @Request() req,
    @Query('planId') planId?: string,
    @Query('page') p = 1,
    @Query('pageSize') ps = 20,
  ) {
    return this.svc.getRecords(req.projectId, planId, +p, +ps)
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.svc.getStats(req.projectId)
  }
}
