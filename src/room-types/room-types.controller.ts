import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Room Types')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all room types' })
  @ResponseMessage('Room types retrieved successfully')
  findAll() {
    return this.roomTypesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a room type by id' })
  @ResponseMessage('Room type retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.roomTypesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a room type (admin only)' })
  @ResponseMessage('Room type created successfully')
  create(@Body() dto: CreateRoomTypeDto) {
    return this.roomTypesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a room type (admin only)' })
  @ResponseMessage('Room type updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.roomTypesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room type (admin only, blocked if rooms are assigned)' })
  @ResponseMessage('Room type deleted successfully')
  remove(@Param('id') id: string) {
    return this.roomTypesService.remove(id);
  }
}
