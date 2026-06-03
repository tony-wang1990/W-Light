import { PartialType } from '@nestjs/swagger'
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { InspectionFrequency } from '../entities/inspection-plan.entity'

export class CreateInspectionPlanDto {
  @IsString()
  name: string

  @IsEnum(InspectionFrequency)
  frequency: InspectionFrequency

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceIds?: string[]

  @IsOptional()
  @IsString()
  assigneeId?: string

  @IsOptional()
  @IsDateString()
  nextInspectionAt?: string
}

export class UpdateInspectionPlanDto extends PartialType(CreateInspectionPlanDto) {
  @IsOptional()
  @IsInt()
  @Min(0)
  isActive?: number
}
