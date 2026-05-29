import { IsString, IsEnum, IsOptional, IsArray, IsDateString, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { OrderCategory, OrderPriority } from '../entities/order.entity'

export class CreateOrderDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  deviceId?: string

  @ApiProperty({ enum: OrderCategory })
  @IsEnum(OrderCategory)
  category: OrderCategory

  @ApiProperty({ enum: OrderPriority, default: OrderPriority.P2 })
  @IsEnum(OrderPriority)
  priority: OrderPriority

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  faultType?: string

  @ApiProperty()
  @IsString()
  faultDesc: string

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsArray()
  @IsOptional()
  mediaUrls?: string[]

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  locationDesc?: string

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  faultAt?: string
}
