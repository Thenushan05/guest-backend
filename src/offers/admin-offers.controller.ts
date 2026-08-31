import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Admin - Offers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/offers')
export class AdminOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'List all offers, including inactive/expired ones (admin only)' })
  @ResponseMessage('Offers retrieved successfully')
  findAll(@Query() query: QueryOffersDto) {
    return this.offersService.findAllAdmin(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an offer (admin only)' })
  @ResponseMessage('Offer created successfully')
  create(@Body() dto: CreateOfferDto) {
    return this.offersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an offer (admin only)' })
  @ResponseMessage('Offer updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.offersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an offer (admin only)' })
  @ResponseMessage('Offer deleted successfully')
  remove(@Param('id') id: string) {
    return this.offersService.remove(id);
  }
}
