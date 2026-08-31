import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { QueryAdminBookingsDto } from './dto/query-admin-bookings.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Admin - Bookings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bookings with filters and pagination (admin only)' })
  @ResponseMessage('Bookings retrieved successfully')
  findAll(@Query() query: QueryAdminBookingsDto) {
    return this.bookingsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any booking by id (admin only)' })
  @ResponseMessage('Booking retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOneAdmin(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending booking, re-checking availability (admin only)' })
  @ResponseMessage('Booking approved successfully')
  approve(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.bookingsService.approve(id, admin.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending booking (admin only)' })
  @ResponseMessage('Booking rejected successfully')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingsService.reject(id, admin.id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel any eligible booking (admin only)' })
  @ResponseMessage('Booking cancelled successfully')
  cancel(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelAsAdmin(id, admin.id, dto);
  }
}
