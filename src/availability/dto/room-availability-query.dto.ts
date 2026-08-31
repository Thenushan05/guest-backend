import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RoomAvailabilityQueryDto {
  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsDateString()
  checkOut: string;
}
