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
  @Column({ type: 'enum', enum: InspectionFrequency, default: InspectionFrequency.DAILY }) frequency: InspectionFrequency
  @Column({ type: 'jsonb', default: '[]' }) deviceIds: string[]
  @Column({ nullable: true }) assigneeId?: string
  @Column({ type: 'timestamptz', nullable: true }) nextInspectionAt?: Date
  @Column({ default: true }) isActive: boolean
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}

@Entity('inspection_records')
export class InspectionRecord {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() planId: string
  @Column() inspectorId: string
  @Column({ type: 'enum', enum: InspectionStatus, default: InspectionStatus.NORMAL }) status: InspectionStatus
  @Column({ type: 'text', nullable: true }) resultDesc?: string
  @Column({ type: 'jsonb', default: '[]' }) photoUrls: string[]
  @Column({ nullable: true }) orderId?: string
  @CreateDateColumn() inspectedAt: Date
}

@Injectable()
class InspectionsService {
  constructor(
    @InjectRepository(InspectionPlan) private planRepo: Repository<InspectionPlan>,
    @InjectRepository(InspectionRecord) private recordRepo: Repository<InspectionRecord>,
  ) {}

  createPlan(dto: Partial<InspectionPlan>) { return this.planRepo.save(this.planRepo.create(dto)) }
  getPlans(projectId: string) { return this.planRepo.find({ where: { projectId, isActive: true } }) }
  createRecord(dto: Partial<InspectionRecord>) { return this.recordRepo.save(this.recordRepo.create(dto)) }
  getRecords(planId: string, page = 1, ps = 20) {
    return this.recordRepo.findAndCount({ where: { planId }, order: { inspectedAt: 'DESC' }, skip: (page-1)*ps, take: ps })
  }
  getTodayPlans(assigneeId: string) {
    return this.planRepo.find({ where: { assigneeId, isActive: true } })
  }
}

@ApiTags('巡检管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
class InspectionsController {
  constructor(private readonly svc: InspectionsService) {}

  @Post('plans') createPlan(@Body() dto: Partial<InspectionPlan>) { return this.svc.createPlan(dto) }
  @Get('plans') getPlans(@Request() req) { return this.svc.getPlans(req.headers['x-project-id']) }
  @Get('today') getTodayPlans(@Request() req) { return this.svc.getTodayPlans(req.user.id) }
  @Post('records') createRecord(@Body() dto: Partial<InspectionRecord>) { return this.svc.createRecord(dto) }
  @Get('records') getRecords(@Query('planId') planId: string, @Query('page') p = 1, @Query('pageSize') ps = 20) {
    return this.svc.getRecords(planId, +p, +ps)
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([InspectionPlan, InspectionRecord])],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
