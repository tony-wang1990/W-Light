import { Module, Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

export enum InspectionFrequency { DAILY = 'daily', WEEKLY = 'weekly', MONTHLY = 'monthly' }
export enum InspectionStatus { NORMAL = 'normal', ABNORMAL = 'abnormal', SKIPPED = 'skipped' }

@Entity('inspection_plans')
export class InspectionPlan {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() projectId: string
  @Column({ length: 100 }) name: string
  // SQLite 兼容：使用 varchar 替代 enum
  @Column({ default: InspectionFrequency.DAILY }) frequency: string
  // SQLite 兼容：使用 simple-json 替代 jsonb
  @Column({ type: 'simple-json', default: '[]' }) deviceIds: string[]
  @Column({ nullable: true }) assigneeId: string
  // SQLite 兼容：使用 datetime 替代 timestamptz
  @Column({ type: 'datetime', nullable: true }) nextInspectionAt: Date
  @Column({ default: 1 }) isActive: number  // SQLite 无布尔值，用 0/1
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}

@Entity('inspection_records')
export class InspectionRecord {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() planId: string
  @Column() inspectorId: string
  // SQLite 兼容：使用 varchar 替代 enum
  @Column({ default: InspectionStatus.NORMAL }) status: string
  @Column({ type: 'text', nullable: true }) resultDesc: string
  // SQLite 兼容：使用 simple-json 替代 jsonb
  @Column({ type: 'simple-json', default: '[]' }) photoUrls: string[]
  @Column({ nullable: true }) orderId: string
  @CreateDateColumn() inspectedAt: Date
}

@Injectable()
class InspectionsService {
  constructor(
    @InjectRepository(InspectionPlan) private planRepo: Repository<InspectionPlan>,
    @InjectRepository(InspectionRecord) private recordRepo: Repository<InspectionRecord>,
  ) {}

  createPlan(dto: Partial<InspectionPlan>) { return this.planRepo.save(this.planRepo.create(dto)) }
  
  updatePlan(id: string, dto: Partial<InspectionPlan>) { return this.planRepo.update(id, dto) }
  
  deletePlan(id: string) { return this.planRepo.delete(id) }

  getPlans(projectId: string) { return this.planRepo.find({ where: { projectId, isActive: 1 } }) }
  
  createRecord(dto: Partial<InspectionRecord>) { return this.recordRepo.save(this.recordRepo.create(dto)) }
  
  getRecords(planId: string, page = 1, ps = 20) {
    return this.recordRepo.findAndCount({ where: { planId }, order: { inspectedAt: 'DESC' }, skip: (page-1)*ps, take: ps })
  }
  
  getTodayPlans(assigneeId: string) {
    return this.planRepo.find({ where: { assigneeId, isActive: 1 } })
  }
  
  async getStats(projectId: string) {
    const total = await this.planRepo.count({ where: { projectId, isActive: 1 } })
    const todayRecords = await this.recordRepo.count()
    return { totalPlans: total, todayRecords }
  }
}

@ApiTags('巡检管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
class InspectionsController {
  constructor(private readonly svc: InspectionsService) {}

  @Post('plans') createPlan(@Body() dto: Partial<InspectionPlan>, @Request() req) {
    return this.svc.createPlan({ ...dto, projectId: req.headers['x-project-id'] })
  }
  
  @Get('plans') getPlans(@Request() req) { return this.svc.getPlans(req.headers['x-project-id']) }
  
  @Put('plans/:id') updatePlan(@Param('id') id: string, @Body() dto: Partial<InspectionPlan>) {
    return this.svc.updatePlan(id, dto)
  }
  
  @Get('today') getTodayPlans(@Request() req) { return this.svc.getTodayPlans(req.user.id) }
  
  @Post('records') createRecord(@Body() dto: Partial<InspectionRecord>, @Request() req) {
    return this.svc.createRecord({ ...dto, inspectorId: req.user.id })
  }
  
  @Get('records') getRecords(@Query('planId') planId: string, @Query('page') p = 1, @Query('pageSize') ps = 20) {
    return this.svc.getRecords(planId, +p, +ps)
  }
  
  @Get('stats') getStats(@Request() req) { return this.svc.getStats(req.headers['x-project-id']) }
}

@Module({
  imports: [TypeOrmModule.forFeature([InspectionPlan, InspectionRecord])],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
