import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class StockMovementDto {
  @IsNumber()
  @Min(0.01)
  quantity: number

  @IsOptional()
  @IsString()
  orderId?: string

  @IsOptional()
  @IsString()
  note?: string
}
