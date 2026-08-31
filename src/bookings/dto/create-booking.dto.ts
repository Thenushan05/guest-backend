import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * What a customer is allowed to submit when creating a booking.
 * Pricing (subtotal/discount/total) and status are NEVER accepted from the
 * client - they are always calculated server-side in BookingsService.
 */
export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsDateString()
  checkOutDate: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfAdults: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  numberOfChildren?: number = 0;

  @ApiPropertyOptional({ example: 'Late check-in around 9 PM, please.' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}
