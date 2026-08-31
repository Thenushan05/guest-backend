import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAdminBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter bookings whose stay overlaps/starts from this check-in date',
  })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ description: 'Filter bookings whose stay ends by this check-out date' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional({ description: 'Only bookings created on/after this date' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Only bookings created on/before this date' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
