import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: true, default: true, description: 'True for AC room, false for Non-AC room' })
  @IsOptional()
  @IsBoolean()
  isAc?: boolean = true;

  @ApiProperty({ example: 'John', description: 'Customer first name (mandatory)' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Customer last name (mandatory)' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+94 77 123 4567', description: 'Customer phone number (mandatory)' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123 Beach Road, Jaffna', description: 'Customer address (mandatory)' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: 'customer@example.com', description: 'Customer email (optional)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Late check-in around 9 PM, please.', description: 'Additional notes (optional)' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}
