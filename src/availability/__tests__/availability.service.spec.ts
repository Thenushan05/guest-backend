/**
 * AvailabilityService – unit tests
 *
 * All Prisma calls are mocked; no database is required.
 *
 * Coverage
 * --------
 * searchAvailableRooms()
 *   ✓ returns rooms with no conflicting bookings
 *   ✓ excludes rooms that have PENDING/APPROVED bookings overlapping the range
 *   ✓ excludes inactive rooms (isActive = false)
 *   ✓ excludes rooms with MAINTENANCE or INACTIVE status
 *   ✓ filters by guests count when supplied
 *   ✓ returns empty array when no candidate rooms exist
 *   ✓ throws InvalidBookingDatesException for invalid date range
 *
 * isRoomAvailableResponse()
 *   ✓ returns { available: true } for a free room
 *   ✓ returns { available: false } for a room with overlapping booking
 *   ✓ returns { available: false } for an inactive room (isActive false)
 *   ✓ returns { available: false } for a room under maintenance
 *   ✓ throws RoomNotFoundException for unknown roomId
 *   ✓ throws InvalidBookingDatesException for invalid date range
 *
 * hasOverlappingBooking()
 *   ✓ returns false when no overlap exists
 *   ✓ returns true when a PENDING booking overlaps
 *   ✓ returns true when an APPROVED booking overlaps
 *   ✓ ignores COMPLETED / CANCELLED / REJECTED bookings
 *   ✓ excludes a given bookingId (used during approve re-check)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { AvailabilityService } from '../availability.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidBookingDatesException, RoomNotFoundException } from '../../common/exceptions/domain-exceptions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROOM_ID = 'room-avail-001';

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    roomNumber: '201',
    name: 'Standard Room',
    description: null,
    roomTypeId: 'rt-001',
    pricePerNight: new Decimal('100.00'),
    maximumGuests: 2,
    numberOfBeds: 1,
    numberOfBathrooms: 1,
    roomSize: 30,
    status: RoomStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roomType: { id: 'rt-001', name: 'Standard' },
    images: [],
    facilities: [],
    offers: [],
    bookings: [],
    ...overrides,
  };
}

/** UTC-midnight Date objects for test date ranges. */
function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

function makePrismaMock() {
  const roomFindUnique = jest.fn();
  const roomFindMany = jest.fn();
  const bookingFindMany = jest.fn();
  const bookingCount = jest.fn();

  return {
    room: { findUnique: roomFindUnique, findMany: roomFindMany },
    booking: { findMany: bookingFindMany, count: bookingCount },
    $queryRaw: jest.fn().mockResolvedValue([]),
    _mocks: { roomFindUnique, roomFindMany, bookingFindMany, bookingCount },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof makePrismaMock>;

  const CHECK_IN = '2026-10-01';
  const CHECK_OUT = '2026-10-05';

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // searchAvailableRooms()
  // =========================================================================

  describe('searchAvailableRooms()', () => {
    it('should return rooms that have no conflicting active bookings', async () => {
      prisma._mocks.roomFindMany.mockResolvedValue([makeRoom()]);
      prisma._mocks.bookingFindMany.mockResolvedValue([]); // no overlapping bookings

      const results = await service.searchAvailableRooms({
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(ROOM_ID);
    });

    it('should exclude rooms with PENDING bookings overlapping the requested dates', async () => {
      prisma._mocks.roomFindMany.mockResolvedValue([makeRoom()]);
      // bookingFindMany returns an overlapping booking → room is excluded
      prisma._mocks.bookingFindMany.mockResolvedValue([{ roomId: ROOM_ID }]);

      const results = await service.searchAvailableRooms({
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
      });

      expect(results).toHaveLength(0);
    });

    it('should return empty array when no candidate rooms exist', async () => {
      prisma._mocks.roomFindMany.mockResolvedValue([]);

      const results = await service.searchAvailableRooms({
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
      });

      expect(results).toHaveLength(0);
      // bookingFindMany should not even be called with an empty candidate list
      expect(prisma._mocks.bookingFindMany).not.toHaveBeenCalled();
    });

    it('should throw InvalidBookingDatesException for an invalid date range (checkOut <= checkIn)', async () => {
      await expect(
        service.searchAvailableRooms({ checkIn: CHECK_OUT, checkOut: CHECK_IN }),
      ).rejects.toBeInstanceOf(InvalidBookingDatesException);
    });

    it('should filter candidate rooms by guest count when guests param is supplied', async () => {
      // room.findMany is the real Prisma call; verify it is invoked with the maximumGuests filter
      prisma._mocks.roomFindMany.mockResolvedValue([]);

      await service.searchAvailableRooms({ checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 3 });

      expect(prisma._mocks.roomFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            maximumGuests: { gte: 3 },
          }),
        }),
      );
    });

    it('should only query rooms that are active and in AVAILABLE status', async () => {
      prisma._mocks.roomFindMany.mockResolvedValue([]);

      await service.searchAvailableRooms({ checkIn: CHECK_IN, checkOut: CHECK_OUT });

      expect(prisma._mocks.roomFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            status: RoomStatus.AVAILABLE,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // isRoomAvailableResponse()
  // =========================================================================

  describe('isRoomAvailableResponse()', () => {
    it('should return { available: true } for an active room with no overlapping bookings', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      prisma._mocks.bookingCount.mockResolvedValue(0);

      const result = await service.isRoomAvailableResponse(ROOM_ID, CHECK_IN, CHECK_OUT);

      expect(result).toEqual({ available: true });
    });

    it('should return { available: false } when an overlapping PENDING/APPROVED booking exists', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      prisma._mocks.bookingCount.mockResolvedValue(1);

      const result = await service.isRoomAvailableResponse(ROOM_ID, CHECK_IN, CHECK_OUT);

      expect(result).toEqual({ available: false });
    });

    it('should return { available: false } for a room with isActive = false', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom({ isActive: false }));

      const result = await service.isRoomAvailableResponse(ROOM_ID, CHECK_IN, CHECK_OUT);

      expect(result).toEqual({ available: false });
    });

    it('should return { available: false } for a room under MAINTENANCE', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(
        makeRoom({ status: RoomStatus.MAINTENANCE }),
      );

      const result = await service.isRoomAvailableResponse(ROOM_ID, CHECK_IN, CHECK_OUT);

      expect(result).toEqual({ available: false });
    });

    it('should return { available: false } for a room with INACTIVE status', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(
        makeRoom({ status: RoomStatus.INACTIVE }),
      );

      const result = await service.isRoomAvailableResponse(ROOM_ID, CHECK_IN, CHECK_OUT);

      expect(result).toEqual({ available: false });
    });

    it('should throw RoomNotFoundException for an unknown roomId', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(null);

      await expect(
        service.isRoomAvailableResponse('nonexistent', CHECK_IN, CHECK_OUT),
      ).rejects.toBeInstanceOf(RoomNotFoundException);
    });

    it('should throw InvalidBookingDatesException for an invalid date range', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());

      await expect(
        service.isRoomAvailableResponse(ROOM_ID, CHECK_OUT, CHECK_IN),
      ).rejects.toBeInstanceOf(InvalidBookingDatesException);
    });
  });

  // =========================================================================
  // hasOverlappingBooking()
  // =========================================================================

  describe('hasOverlappingBooking()', () => {
    const checkIn = utcDate(2026, 10, 1);
    const checkOut = utcDate(2026, 10, 5);

    it('should return false when no active overlapping bookings exist', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(0);

      const result = await service.hasOverlappingBooking(prisma as never, ROOM_ID, checkIn, checkOut);

      expect(result).toBe(false);
    });

    it('should return true when a PENDING booking overlaps the range', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(1);

      const result = await service.hasOverlappingBooking(prisma as never, ROOM_ID, checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should return true when an APPROVED booking overlaps the range', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(1);

      const result = await service.hasOverlappingBooking(prisma as never, ROOM_ID, checkIn, checkOut);

      expect(result).toBe(true);
    });

    it('should query only PENDING and APPROVED statuses (blocking statuses)', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(0);

      await service.hasOverlappingBooking(prisma as never, ROOM_ID, checkIn, checkOut);

      expect(prisma._mocks.bookingCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED] },
          }),
        }),
      );
    });

    it('should exclude a specified bookingId from the overlap check (approve re-check)', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(0);

      await service.hasOverlappingBooking(
        prisma as never,
        ROOM_ID,
        checkIn,
        checkOut,
        'exclude-me',
      );

      expect(prisma._mocks.bookingCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'exclude-me' },
          }),
        }),
      );
    });

    it('should use the correct date overlap SQL logic (checkIn < checkOut AND checkOut > checkIn)', async () => {
      prisma._mocks.bookingCount.mockResolvedValue(0);

      await service.hasOverlappingBooking(prisma as never, ROOM_ID, checkIn, checkOut);

      const callArgs = prisma._mocks.bookingCount.mock.calls[0][0];
      expect(callArgs.where.checkInDate).toEqual({ lt: checkOut });
      expect(callArgs.where.checkOutDate).toEqual({ gt: checkIn });
    });
  });
});
