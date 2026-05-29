import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bull'
import { ScheduleModule } from '@nestjs/schedule'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { OrderStateMachine } from './order-state.machine'
import { WorkOrder } from './entities/order.entity'
import { RepairLog } from './entities/repair-log.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder, RepairLog]),
    BullModule.registerQueue({ name: 'notifications' }),
    ScheduleModule.forRoot(),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateMachine],
  exports: [OrdersService],
})
export class OrdersModule {}
