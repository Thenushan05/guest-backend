import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFacilityDto {
  @ApiProperty({ example: 'WiFi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'wifi', description: 'Icon identifier used by the frontend' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 'Free high-speed wireless internet' })
  @IsOptional()
  @IsString()
  description?: string;
}
