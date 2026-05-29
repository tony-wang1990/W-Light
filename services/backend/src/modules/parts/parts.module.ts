import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SparePart } from './entities/spare-part.entity'
import { SparePartLog } from './entities/spare-part-log.entity'
import { PartsController } from './parts.controller'
import { PartsService } from './parts.service'

@Module({
  imports: [TypeOrmModule.forFeature([SparePart, SparePartLog])],
  controllers: [PartsController],
  providers: [PartsService],
  exports: [PartsService],
})
export class PartsModule {}
