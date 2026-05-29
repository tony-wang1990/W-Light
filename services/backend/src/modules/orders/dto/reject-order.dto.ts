import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RejectOrderDto {
  @ApiProperty({ description: '拒绝/退回/取消原因' })
  @IsString()
  @MinLength(5)
  reason: string
}
