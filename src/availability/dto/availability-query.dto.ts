import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsDateString()
  checkOut: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
