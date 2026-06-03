import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { InspectionStatus } from '../entities/inspection-record.entity'

export class CreateInspectionRecordDto {
  @IsOptional()
  @IsString()
  planId?: string

  @IsEnum(InspectionStatus)
  status: InspectionStatus

  @IsOptional()
  @IsString()
  resultDesc?: string

  @IsOptional()
  @IsString()
  orderId?: string

  @IsOptional()
  @IsBoolean()
  createOrder?: boolean
}
