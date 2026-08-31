import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Deluxe Room' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Spacious room with a garden view and king-size bed' })
  @IsOptional()
  @IsString()
  description?: string;
}
