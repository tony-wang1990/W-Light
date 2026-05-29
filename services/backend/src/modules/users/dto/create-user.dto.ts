import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  MinLength,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Zhang Wei', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '13800000002', description: 'Phone number (login)' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Engineer@123', description: 'Initial password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ENGINEER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: ['proj-001'], description: 'Project IDs user belongs to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectIds?: string[];

  @ApiPropertyOptional({ example: 'EMP-001' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'electrical' })
  @IsOptional()
  @IsString()
  specialization?: string;
}
