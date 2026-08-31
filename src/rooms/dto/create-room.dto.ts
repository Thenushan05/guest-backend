import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  roomNumber: string;

  @ApiProperty({ example: 'Garden View Deluxe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'A spacious deluxe room overlooking the garden.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Id of the RoomType this room belongs to' })
  @IsString()
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({ example: 12000, description: 'Price per night in LKR' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerNight: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maximumGuests: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfBeds: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfBathrooms?: number = 1;

  @ApiPropertyOptional({ example: 320, description: 'Room size in square feet' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  roomSize?: number;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus = RoomStatus.AVAILABLE;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ type: [String], description: 'Facility ids to attach to this room' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  facilityIds?: string[];
}
