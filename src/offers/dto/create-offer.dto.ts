import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateOfferDto {
  @ApiProperty({ example: 'Early Bird Special' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Book 3 nights or more and save 10%' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    example: 10,
    description: 'Percentage (0-100) or fixed LKR amount depending on discountType',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  discountValue: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumNights?: number = 1;

  @ApiPropertyOptional({ description: 'Restrict this offer to a specific room type' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({ description: 'Restrict this offer to a specific room' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerImage?: string;
}
