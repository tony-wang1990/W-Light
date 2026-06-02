import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { User } from './entities/user.entity'
import { WorkOrder } from '../orders/entities/order.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User, WorkOrder])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
