import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ImageOrderItem {
  @ApiProperty()
  @IsString()
  imageId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderImagesDto {
  @ApiProperty({ type: [ImageOrderItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImageOrderItem)
  items: ImageOrderItem[];
}
