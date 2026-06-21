import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { OrderStateMachine } from './order-state.machine'
import { WorkOrder } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'
import { PartsModule } from '../parts/parts.module'
import { User } from '../users/entities/user.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder, RepairLog, User]),
    ScheduleModule.forRoot(),
    PartsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateMachine],
  exports: [OrdersService],
})
export class OrdersModule {}
