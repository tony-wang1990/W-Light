import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AddRepairLogDto {
  @ApiProperty({ description: '维修步骤类型', example: '更换' })
  @IsString()
  stepType: string

  @ApiProperty({ description: '维修步骤说明' })
  @IsString()
  stepDesc: string

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsArray()
  @IsOptional()
  photoUrls?: string[]

  @ApiProperty({ required: false, description: '外包供应商名称' })
  @IsString()
  @IsOptional()
  outsourceVendor?: string

  @ApiProperty({ required: false, description: '外包费用（元）' })
  @IsOptional()
  outsourceCost?: number

  @ApiProperty({
    required: false,
    description: '本次维修消耗的备件',
    example: [{ partId: 'uuid', quantity: 2, note: '更换损坏电源模块' }],
  })
  @IsArray()
  @IsOptional()
  partUsages?: Array<{
    partId: string
    quantity: number
    note?: string
  }>
}
