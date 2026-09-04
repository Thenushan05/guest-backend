import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Prisma, Role, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { OffersService } from '../offers/offers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryMyBookingsDto } from './dto/query-my-bookings.dto';
import { QueryAdminBookingsDto } from './dto/query-admin-bookings.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import {
  bookingIncludeArgs,
  BookingResponse,
  mapBookingToResponse,
} from './mappers/booking.mapper';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  BookingAlreadyProcessedException,
  BookingNotCancellableException,
  BookingNotFoundException,
  RoomCapacityExceededException,
  RoomInactiveException,
  RoomNotAvailableException,
  RoomNotFoundException,
  RoomUnderMaintenanceException,
} from '../common/exceptions/domain-exceptions';
import {
  assertValidDateRange,
  calculateNights,
  toUtcDateOnly,
  todayUtcDateOnly,
} from '../common/utils/date.util';
import { roundCurrency, toNumber } from '../common/utils/decimal.util';
import { generateBookingNumber } from '../common/utils/booking-number.util';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';
import { ForbiddenDomainException } from '../common/exceptions/domain.exception';
import { ErrorCode } from '../common/enums/error-code.enum';

/** Statuses from which a booking can still be cancelled. */
const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly offersService: OffersService,
  ) {}

  /**
   * Creates a booking request. Every pricing figure is derived from the
   * database inside a single transaction, which also serializes concurrent
   * attempts on the same room via a row lock before the overlap check runs.
   */
  async create(userId: string, dto: CreateBookingDto): Promise<BookingResponse> {
    const checkInDate = toUtcDateOnly(dto.checkInDate);
    const checkOutDate = toUtcDateOnly(dto.checkOutDate);
    assertValidDateRange(checkInDate, checkOutDate);

    const numberOfAdults = dto.numberOfAdults;
    const numberOfChildren = dto.numberOfChildren ?? 0;
    const numberOfGuests = numberOfAdults + numberOfChildren;

    const booking = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room) throw new RoomNotFoundException();
      if (!room.isActive || room.status === RoomStatus.INACTIVE) throw new RoomInactiveException();
      if (room.status === RoomStatus.MAINTENANCE) throw new RoomUnderMaintenanceException();
      if (numberOfGuests > room.maximumGuests) {
        throw new RoomCapacityExceededException(room.maximumGuests);
      }

      // Serialize concurrent booking attempts for this exact room.
      await this.availabilityService.lockRoomForUpdate(tx, room.id);

      const hasOverlap = await this.availabilityService.hasOverlappingBooking(
        tx,
        room.id,
        checkInDate,
        checkOutDate,
      );
      if (hasOverlap) throw new RoomNotAvailableException();

      const numberOfNights = calculateNights(checkInDate, checkOutDate);
      const pricePerNight = toNumber(room.pricePerNight);
      const subtotal = roundCurrency(pricePerNight * numberOfNights);

      const appliedOffer = await this.offersService.findBestApplicableOffer({
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        checkInDate,
        numberOfNights,
        subtotal,
      });

      const discountAmount = appliedOffer?.discountAmount ?? 0;
      const totalAmount = roundCurrency(subtotal - discountAmount);
      const bookingNumber = await generateBookingNumber(tx);

      const created = await tx.booking.create({
        data: {
          bookingNumber,
          userId,
          roomId: room.id,
          checkInDate,
          checkOutDate,
          numberOfGuests,
          numberOfAdults,
          numberOfChildren,
          numberOfNights,
          pricePerNight,
          subtotal,
          discountAmount,
          totalAmount,
          offerId: appliedOffer?.offerId,
          status: BookingStatus.PENDING,
          customerNote: dto.customerNote,
        },
        include: bookingIncludeArgs,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          status: BookingStatus.PENDING,
          changedBy: userId,
          note: 'Booking request created by customer',
        },
      });

      return created;
    });

    return mapBookingToResponse(booking);
  }

  async findMyBookings(
    userId: string,
    query: QueryMyBookingsDto,
  ): Promise<PaginatedResult<BookingResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: Prisma.BookingWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    // Promise.all, not $transaction: independent reads run concurrently over
    // the pool instead of serialized in one DB transaction/connection.
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: bookingIncludeArgs,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return buildPaginatedResult(bookings.map(mapBookingToResponse), page, limit, total);
  }

  async findOne(id: string, requestingUser: AuthenticatedUser): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingIncludeArgs,
    });
    if (!booking) throw new BookingNotFoundException();

    if (requestingUser.role !== Role.ADMIN && booking.userId !== requestingUser.id) {
      throw new ForbiddenDomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this booking',
      );
    }

    return mapBookingToResponse(booking);
  }

  /** Customer-initiated cancellation of their own booking. */
  async cancelOwn(id: string, userId: string, dto: CancelBookingDto): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new BookingNotFoundException();

    if (booking.userId !== userId) {
      throw new ForbiddenDomainException(
        ErrorCode.FORBIDDEN,
        'You can only cancel your own bookings',
      );
    }

    this.assertCancellable(booking.status, booking.checkInDate);

    return this.applyCancellation(id, userId, dto.cancellationReason);
  }

  /** Admin can cancel any eligible booking. */
  async cancelAsAdmin(
    id: string,
    adminId: string,
    dto: CancelBookingDto,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new BookingNotFoundException();

    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BookingAlreadyProcessedException(booking.status);
    }

    return this.applyCancellation(id, adminId, dto.cancellationReason);
  }

  // ---------------------------------------------------------------------
  // Admin queries & lifecycle
  // ---------------------------------------------------------------------

  async findAllAdmin(query: QueryAdminBookingsDto): Promise<PaginatedResult<BookingResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.checkIn ? { checkInDate: { gte: toUtcDateOnly(query.checkIn) } } : {}),
      ...(query.checkOut ? { checkOutDate: { lte: toUtcDateOnly(query.checkOut) } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { bookingNumber: { contains: query.search } },
              { user: { firstName: { contains: query.search } } },
              { user: { lastName: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.BookingOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    // Promise.all, not $transaction: independent reads run concurrently over
    // the pool instead of serialized in one DB transaction/connection.
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({ where, orderBy, skip, take, include: bookingIncludeArgs }),
      this.prisma.booking.count({ where }),
    ]);

    return buildPaginatedResult(bookings.map(mapBookingToResponse), page, limit, total);
  }

  async findOneAdmin(id: string): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingIncludeArgs,
    });
    if (!booking) throw new BookingNotFoundException();
    return mapBookingToResponse(booking);
  }

  /**
   * Approves a PENDING booking. Re-checks availability inside the same
   * transaction (with a row lock) to close the race window between the
   * customer's request and the admin's approval - the whole reason this
   * check must never rely on frontend state.
   */
  async approve(id: string, adminId: string): Promise<BookingResponse> {
    const booking = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) throw new BookingNotFoundException();
      if (existing.status !== BookingStatus.PENDING) {
        throw new BookingAlreadyProcessedException(existing.status);
      }

      await this.availabilityService.lockRoomForUpdate(tx, existing.roomId);

      const hasOverlap = await this.availabilityService.hasOverlappingBooking(
        tx,
        existing.roomId,
        existing.checkInDate,
        existing.checkOutDate,
        existing.id,
      );
      if (hasOverlap) {
        throw new RoomNotAvailableException('Room is no longer available for the selected dates.');
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.APPROVED, approvedBy: adminId, approvedAt: new Date() },
        include: bookingIncludeArgs,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: BookingStatus.APPROVED,
          changedBy: adminId,
          note: 'Booking approved by admin',
        },
      });

      return updated;
    });

    return mapBookingToResponse(booking);
  }

  async reject(id: string, adminId: string, dto: RejectBookingDto): Promise<BookingResponse> {
    const booking = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id } });
      if (!existing) throw new BookingNotFoundException();
      if (existing.status !== BookingStatus.PENDING) {
        throw new BookingAlreadyProcessedException(existing.status);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: dto.rejectionReason,
        },
        include: bookingIncludeArgs,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: BookingStatus.REJECTED,
          changedBy: adminId,
          note: dto.rejectionReason ?? 'Booking rejected by admin',
        },
      });

      return updated;
    });

    return mapBookingToResponse(booking);
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  private assertCancellable(status: BookingStatus, checkInDate: Date): void {
    if (!CANCELLABLE_STATUSES.includes(status)) {
      throw new BookingNotCancellableException(
        `Bookings with status ${status} can no longer be cancelled`,
      );
    }

    if (checkInDate.getTime() <= todayUtcDateOnly().getTime()) {
      throw new BookingNotCancellableException(
        'This booking can no longer be cancelled as the check-in date has arrived or passed',
      );
    }
  }

  private async applyCancellation(
    id: string,
    changedBy: string,
    reason: string | undefined,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: bookingIncludeArgs,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          status: BookingStatus.CANCELLED,
          changedBy,
          note: reason ?? 'Booking cancelled',
        },
      });

      return updated;
    });

    return mapBookingToResponse(booking);
  }
}
