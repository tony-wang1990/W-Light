import { IsString, IsPhoneNumber, IsOptional, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: '13800000001' })
  @IsString()
  phone: string

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  password: string

  @ApiProperty({ required: false, description: '选择进入的项目ID' })
  @IsUUID()
  @IsOptional()
  projectId?: string
}
