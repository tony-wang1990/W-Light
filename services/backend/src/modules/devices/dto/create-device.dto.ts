import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DeviceStatus, DeviceCategory } from '../entities/device.entity';

export class CreateDeviceDto {
  @ApiProperty({ example: 'DEV-2026-0001', description: '项目内设备编号' })
  @IsString()
  @IsNotEmpty()
  deviceNo: string;

  @ApiProperty({ example: '主舞台摇头灯 01' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'QR-DEV-001' })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiProperty({ enum: DeviceCategory })
  @IsEnum(DeviceCategory)
  category: DeviceCategory;

  @ApiPropertyOptional({ example: 'MA Lighting' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'grandMA3 full-size' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: '主舞台左侧灯架' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: DeviceStatus, default: DeviceStatus.NORMAL })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional({ description: 'DMX universe number' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dmxUniverse?: number;

  @ApiPropertyOptional({ description: 'DMX start address (1-512)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(512)
  dmxAddress?: number;

  @ApiPropertyOptional({ description: '灯具通道数' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(512)
  channelCount?: number;

  @ApiPropertyOptional({ description: '额定功率 W' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  power?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyExpire?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  installDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manualUrl?: string;
}
