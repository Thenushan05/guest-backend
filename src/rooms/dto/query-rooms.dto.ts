import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryRoomsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  minimumPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  maximumPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({ enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
