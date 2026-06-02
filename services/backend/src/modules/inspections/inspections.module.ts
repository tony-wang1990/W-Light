import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrdersModule } from '../orders/orders.module'
import { InspectionPlan } from './entities/inspection-plan.entity'
import { InspectionRecord } from './entities/inspection-record.entity'
import { InspectionsController } from './inspections.controller'
import { InspectionsService } from './inspections.service'

@Module({
  imports: [TypeOrmModule.forFeature([InspectionPlan, InspectionRecord]), OrdersModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}

export { InspectionFrequency, InspectionPlan } from './entities/inspection-plan.entity'
export { InspectionRecord, InspectionStatus } from './entities/inspection-record.entity'
export { InspectionsService } from './inspections.service'
