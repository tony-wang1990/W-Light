import { PartialType } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreatePartDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  unit?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number

  @IsOptional()
  @IsString()
  supplier?: string

  @IsOptional()
  @IsString()
  supplierPhone?: string
}

export class UpdatePartDto extends PartialType(CreatePartDto) {}
