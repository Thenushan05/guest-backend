import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryMyBookingsDto } from './dto/query-my-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.CUSTOMER)
  @Post()
  @ApiOperation({ summary: 'Create a booking request (customer only)' })
  @ResponseMessage('Booking created successfully')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.CUSTOMER)
  @Get('my')
  @ApiOperation({ summary: "List the authenticated customer's own bookings" })
  @ResponseMessage('Bookings retrieved successfully')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryMyBookingsDto) {
    return this.bookingsService.findMyBookings(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details (owner customer or admin)' })
  @ResponseMessage('Booking retrieved successfully')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findOne(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.CUSTOMER)
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel one of your own eligible bookings' })
  @ResponseMessage('Booking cancelled successfully')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelOwn(id, user.id, dto);
  }
}
