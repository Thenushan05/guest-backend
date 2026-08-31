import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { QueryOffersDto } from './dto/query-offers.dto';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Offers')
@Public()
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'List currently active offers' })
  @ResponseMessage('Offers retrieved successfully')
  findAll(@Query() query: QueryOffersDto) {
    return this.offersService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an offer by id' })
  @ResponseMessage('Offer retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }
}
