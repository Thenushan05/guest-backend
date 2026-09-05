import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUrl } from 'class-validator';

export class AddImageUrlsDto {
  @ApiProperty({
    example: ['https://example.com/image.jpg'],
    description: 'Array of image URLs to add to the room',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({}, { each: true, message: 'Each item must be a valid URL' })
  urls: string[];
}
