import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { InspectionPlan } from './entities/inspection-plan.entity'
import { CreateInspectionRecordPayload, InspectionsService } from './inspections.service'

@ApiTags('巡检管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly svc: InspectionsService) {}

  @Post('plans')
  createPlan(@Body() dto: Partial<InspectionPlan>, @Request() req) {
    return this.svc.createPlan({ ...dto, projectId: req.headers['x-project-id'] })
  }

  @Get('plans')
  getPlans(@Request() req) {
    return this.svc.getPlans(req.headers['x-project-id'])
  }

  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: Partial<InspectionPlan>) {
    return this.svc.updatePlan(id, dto)
  }

  @Get('today')
  getTodayPlans(@Request() req) {
    return this.svc.getTodayPlans(req.user.id, req.headers['x-project-id'])
  }

  @Post('records')
  createRecord(@Body() dto: CreateInspectionRecordPayload, @Request() req) {
    return this.svc.createRecord(dto, req.user.id, req.headers['x-project-id'])
  }

  @Get('records')
  getRecords(
    @Request() req,
    @Query('planId') planId?: string,
    @Query('page') p = 1,
    @Query('pageSize') ps = 20,
  ) {
    return this.svc.getRecords(req.headers['x-project-id'], planId, +p, +ps)
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.svc.getStats(req.headers['x-project-id'])
  }
}
