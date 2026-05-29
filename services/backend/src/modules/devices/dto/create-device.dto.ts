import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { DeviceStatus, DeviceCategory } from '../entities/device.entity';

export class CreateDeviceDto {
  @ApiProperty({ description: 'Project ID this device belongs to' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'Main Stage Light 01' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'DEV-2024-001', description: 'Unique device code' })
  @IsString()
  @IsNotEmpty()
  deviceCode: string;

  @ApiPropertyOptional({ example: 'QR-DEV-001' })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiProperty({ enum: DeviceCategory })
  @IsEnum(DeviceCategory)
  category: DeviceCategory;

  @ApiPropertyOptional({ enum: DeviceStatus, default: DeviceStatus.NORMAL })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional({ example: 'West Lake Main Stage' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Position 3, Row B' })
  @IsOptional()
  @IsString()
  locationDetail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Philips' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'ColorGraze MX' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @ApiPropertyOptional({ description: 'DMX universe number' })
  @IsOptional()
  @IsNumber()
  dmxUniverse?: number;

  @ApiPropertyOptional({ description: 'DMX start address (1-512)' })
  @IsOptional()
  @IsNumber()
  dmxAddress?: number;

  @ApiPropertyOptional({ description: 'Rated power in watts' })
  @IsOptional()
  @IsNumber()
  ratedPower?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Custom attributes as key-value pairs' })
  @IsOptional()
  attributes?: Record<string, any>;
}
