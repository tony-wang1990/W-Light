import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DevicesController } from './devices.controller'
import { DevicesPublicController } from './devices-public.controller'
import { DevicesService } from './devices.service'
import { Device } from './entities/device.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  controllers: [DevicesController, DevicesPublicController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
