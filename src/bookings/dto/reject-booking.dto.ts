import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'Room is reserved for maintenance during this period.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
