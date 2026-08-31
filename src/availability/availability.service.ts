import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { mapRoomToResponse, roomIncludeArgs, RoomResponse } from '../rooms/mappers/room.mapper';
import { assertValidDateRange, toUtcDateOnly } from '../common/utils/date.util';
import { RoomNotFoundException } from '../common/exceptions/domain-exceptions';

/** Bookings in these statuses hold a claim on the room's calendar. */
const BLOCKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED];

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /availability - returns active, non-maintenance rooms that satisfy
   * the guest count and have no PENDING/APPROVED booking overlapping the
   * requested date range.
   */
  async searchAvailableRooms(query: AvailabilityQueryDto): Promise<RoomResponse[]> {
    const checkIn = toUtcDateOnly(query.checkIn);
    const checkOut = toUtcDateOnly(query.checkOut);
    assertValidDateRange(checkIn, checkOut);

    const candidateRooms = await this.prisma.room.findMany({
      where: {
        isActive: true,
        status: RoomStatus.AVAILABLE,
        ...(query.guests ? { maximumGuests: { gte: query.guests } } : {}),
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      },
      include: roomIncludeArgs,
    });

    if (candidateRooms.length === 0) return [];

    const overlappingRoomIds = await this.findOverlappingRoomIds(
      this.prisma,
      candidateRooms.map((r) => r.id),
      checkIn,
      checkOut,
    );

    return candidateRooms.filter((room) => !overlappingRoomIds.has(room.id)).map(mapRoomToResponse);
  }

  /** GET /rooms/:id/availability response shape: { available: boolean } */
  async isRoomAvailableResponse(
    roomId: string,
    checkInStr: string,
    checkOutStr: string,
  ): Promise<{ available: boolean }> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new RoomNotFoundException();

    const checkIn = toUtcDateOnly(checkInStr);
    const checkOut = toUtcDateOnly(checkOutStr);
    assertValidDateRange(checkIn, checkOut);

    if (!room.isActive || room.status !== RoomStatus.AVAILABLE) {
      return { available: false };
    }

    const hasOverlap = await this.hasOverlappingBooking(this.prisma, roomId, checkIn, checkOut);
    return { available: !hasOverlap };
  }

  /**
   * Core overlap check, reused by booking creation and booking approval so
   * the exact same rule governs every path that can claim a room.
   * Accepts a transaction client so it can run inside the same DB
   * transaction as the booking write it is guarding.
   */
  async hasOverlappingBooking(
    client: PrismaOrTx,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const count = await client.booking.count({
      where: {
        roomId,
        status: { in: BLOCKING_STATUSES },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
    });
    return count > 0;
  }

  /**
   * Locks the room row (SELECT ... FOR UPDATE) inside an active transaction
   * so concurrent booking attempts on the *same* room serialize instead of
   * racing past the overlap check together. This is the mechanism that
   * actually prevents double-booking under concurrency.
   */
  async lockRoomForUpdate(tx: Prisma.TransactionClient, roomId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
  }

  private async findOverlappingRoomIds(
    client: PrismaOrTx,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
  ): Promise<Set<string>> {
    const overlapping = await client.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: BLOCKING_STATUSES },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true },
    });
    return new Set(overlapping.map((b) => b.roomId));
  }
}
