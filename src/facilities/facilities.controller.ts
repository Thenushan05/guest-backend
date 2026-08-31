import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all facilities' })
  @ResponseMessage('Facilities retrieved successfully')
  findAll() {
    return this.facilitiesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a facility by id' })
  @ResponseMessage('Facility retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.facilitiesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a facility (admin only)' })
  @ResponseMessage('Facility created successfully')
  create(@Body() dto: CreateFacilityDto) {
    return this.facilitiesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a facility (admin only)' })
  @ResponseMessage('Facility updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilitiesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a facility (admin only)' })
  @ResponseMessage('Facility deleted successfully')
  remove(@Param('id') id: string) {
    return this.facilitiesService.remove(id);
  }
}
