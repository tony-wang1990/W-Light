import { IsNumber, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SubmitOrderDto {
  @ApiProperty({ required: false, description: '本次维修总费用（元）' })
  @IsNumber()
  @IsOptional()
  repairCost?: number
}
