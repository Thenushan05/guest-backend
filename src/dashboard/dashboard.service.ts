import { Injectable } from '@nestjs/common';
import { BookingStatus, Role, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { todayUtcDateOnly } from '../common/utils/date.util';

export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  maintenanceRooms: number;
  totalCustomers: number;
  pendingBookings: number;
  approvedBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  upcomingBookings: number;
}

/**
 * Kept intentionally simple and easy to extend - each stat is an isolated
 * count query run in parallel, so adding a new metric later means adding
 * one more entry to this Promise.all, nothing else.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const today = todayUtcDateOnly();

    const [
      totalRooms,
      availableRooms,
      maintenanceRooms,
      totalCustomers,
      pendingBookings,
      approvedBookings,
      todayCheckIns,
      todayCheckOuts,
      upcomingBookings,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { isActive: true, status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { status: RoomStatus.MAINTENANCE } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.booking.count({ where: { status: BookingStatus.APPROVED } }),
      this.prisma.booking.count({
        where: { status: BookingStatus.APPROVED, checkInDate: today },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.APPROVED, checkOutDate: today },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.APPROVED, checkInDate: { gt: today } },
      }),
    ]);

    return {
      totalRooms,
      availableRooms,
      maintenanceRooms,
      totalCustomers,
      pendingBookings,
      approvedBookings,
      todayCheckIns,
      todayCheckOuts,
      upcomingBookings,
    };
  }
}
