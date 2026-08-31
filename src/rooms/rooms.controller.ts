import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { AvailabilityService } from '../availability/availability.service';
import { RoomAvailabilityQueryDto } from '../availability/dto/room-availability-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { multerImageOptions } from '../uploads/multer.config';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List rooms with pagination, search and filters' })
  @ResponseMessage('Rooms retrieved successfully')
  findAll(@Query() query: QueryRoomsDto) {
    return this.roomsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get room details including images and facilities' })
  @ResponseMessage('Room retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Public()
  @Get(':id/availability')
  @ApiOperation({ summary: 'Check whether a specific room is available for given dates' })
  @ApiQuery({ name: 'checkIn', example: '2026-09-10' })
  @ApiQuery({ name: 'checkOut', example: '2026-09-12' })
  @ResponseMessage('Room availability checked successfully')
  checkAvailability(@Param('id') id: string, @Query() query: RoomAvailabilityQueryDto) {
    return this.availabilityService.isRoomAvailableResponse(id, query.checkIn, query.checkOut);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new room (admin only)' })
  @ResponseMessage('Room created successfully')
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a room (admin only)' })
  @ResponseMessage('Room updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a room (admin only). Historical bookings are preserved.' })
  @ResponseMessage('Room deactivated successfully')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one or more images for a room (admin only)' })
  @UseInterceptors(FilesInterceptor('images', 10, multerImageOptions))
  @ResponseMessage('Room images uploaded successfully')
  addImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.roomsService.addImages(id, files);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Reorder room images (admin only)' })
  @ResponseMessage('Room images reordered successfully')
  reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto) {
    return this.roomsService.reorderImages(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/images/:imageId/primary')
  @ApiOperation({ summary: 'Set an image as the room primary image (admin only)' })
  @ResponseMessage('Primary image updated successfully')
  setPrimaryImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.roomsService.setPrimaryImage(id, imageId);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Delete a room image (admin only)' })
  @ResponseMessage('Room image deleted successfully')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.roomsService.removeImage(id, imageId);
  }
}
