import { IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AssignOrderDto {
  @ApiProperty({ description: '派单给此用户ID' })
  @IsUUID()
  assigneeId: string
}
