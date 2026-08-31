import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Availability')
@Public()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({
    summary: 'Search for rooms available for the given dates, guest count and room type',
  })
  @ResponseMessage('Available rooms retrieved successfully')
  search(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.searchAvailableRooms(query);
  }
}
