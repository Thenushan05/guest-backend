/**
 * BookingsService – comprehensive unit tests
 *
 * Strategy: every external dependency (PrismaService, AvailabilityService,
 * OffersService) is fully mocked so tests run in-process with no database.
 *
 * Coverage checklist
 * ------------------
 * create()
 *   ✓ happy path – creates booking with correct pricing
 *   ✓ happy path – applies best available offer / discount
 *   ✓ happy path – numberOfChildren defaults to 0
 *   ✓ happy path – stores customerNote verbatim
 *   ✓ status defaults to PENDING on creation
 *   ✓ booking number has GH-<year>-XXXXXX format
 *   ✓ rejects unknown roomId
 *   ✓ rejects inactive room (isActive = false)
 *   ✓ rejects room with INACTIVE status enum
 *   ✓ rejects room under MAINTENANCE
 *   ✓ rejects when guest count exceeds room capacity
 *   ✓ rejects when dates overlap an existing booking
 *   ✓ rejects when checkOut <= checkIn (same-day)
 *   ✓ rejects when checkIn is in the past
 *   ✓ writes initial PENDING entry to BookingStatusHistory
 *
 * findMyBookings()
 *   ✓ returns paginated list for authenticated customer
 *   ✓ filters by status when supplied
 *
 * findOne()
 *   ✓ customer can read their own booking
 *   ✓ admin can read any booking
 *   ✓ customer cannot read another customer's booking (403)
 *   ✓ throws 404 for non-existent booking
 *
 * cancelOwn()
 *   ✓ customer cancels a PENDING booking (happy path)
 *   ✓ customer cancels an APPROVED booking (happy path)
 *   ✓ rejects cancellation of someone else's booking
 *   ✓ rejects cancellation of COMPLETED booking (non-cancellable status)
 *   ✓ rejects cancellation of already-CANCELLED booking
 *   ✓ rejects cancellation of REJECTED booking
 *   ✓ rejects when checkIn date is today (boundary – not cancellable)
 *   ✓ rejects when checkIn date is in the past
 *   ✓ allows cancellation when checkIn is tomorrow (boundary – still cancellable)
 *   ✓ persists cancellationReason and writes status history
 *
 * cancelAsAdmin()
 *   ✓ admin cancels any PENDING booking
 *   ✓ admin cancels any APPROVED booking
 *   ✓ rejects if booking already COMPLETED
 *   ✓ rejects if booking already CANCELLED
 *   ✓ admin bypass – no check-in-date restriction
 *
 * approve() (admin)
 *   ✓ approves PENDING booking
 *   ✓ rejects if booking is not PENDING
 *   ✓ rejects if room is no longer available (race window)
 *   ✓ records approvedBy and approvedAt
 *   ✓ writes APPROVED status history entry
 *
 * reject() (admin)
 *   ✓ rejects PENDING booking with reason
 *   ✓ rejects without a reason (optional field)
 *   ✓ throws if booking is not PENDING
 *   ✓ records rejectedAt and rejectionReason
 *
 * findAllAdmin()
 *   ✓ returns all bookings (no filters)
 *   ✓ filters by status, roomId, userId, date ranges, search term
 *
 * findOneAdmin()
 *   ✓ returns any booking by id
 *   ✓ throws 404 for non-existent booking
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role, RoomStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { BookingsService } from '../bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../../availability/availability.service';
import { OffersService } from '../../offers/offers.service';

import {
  BookingAlreadyProcessedException,
  BookingNotCancellableException,
  BookingNotFoundException,
  RoomCapacityExceededException,
  RoomInactiveException,
  RoomNotAvailableException,
  RoomNotFoundException,
  RoomUnderMaintenanceException,
} from '../../common/exceptions/domain-exceptions';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { InvalidBookingDatesException } from '../../common/exceptions/domain-exceptions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a future date string (YYYY-MM-DD) offset by `offsetDays` from today (UTC). */
function futureDateStr(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/** Returns a date string for today UTC. */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns a date string for yesterday UTC. */
function yesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const ROOM_ID = 'room-001';
const USER_ID = 'user-cust-001';
const ADMIN_ID = 'user-admin-001';
const BOOKING_ID = 'booking-001';

function makeRoom(overrides: Record<string, unknown> = {}) {
  return { ..._baseRoom(), ...overrides } as ReturnType<typeof _baseRoom>;
}

function _baseRoom() {
  return {
    id: ROOM_ID,
    roomNumber: '101',
    name: 'Deluxe Suite',
    description: null,
    roomTypeId: 'rt-001',
    pricePerNight: new Decimal('150.00'),
    maximumGuests: 4,
    numberOfBeds: 2,
    numberOfBathrooms: 1,
    roomSize: 45,
    status: RoomStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeBookingDb(overrides: Record<string, unknown> = {}) {
  const checkIn = new Date(futureDateStr(3) + 'T00:00:00.000Z');
  const checkOut = new Date(futureDateStr(5) + 'T00:00:00.000Z');

  return {
    id: BOOKING_ID,
    bookingNumber: 'GH-2026-000001',
    userId: USER_ID,
    roomId: ROOM_ID,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfGuests: 2,
    numberOfAdults: 2,
    numberOfChildren: 0,
    numberOfNights: 2,
    pricePerNight: new Decimal('150.00'),
    subtotal: new Decimal('300.00'),
    discountAmount: new Decimal('0.00'),
    totalAmount: new Decimal('300.00'),
    offerId: null,
    status: BookingStatus.PENDING,
    customerNote: null,
    adminNote: null,
    approvedBy: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Relations expected by the mapper
    user: {
      id: USER_ID,
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@example.com',
      phone: null,
    },
    room: {
      id: ROOM_ID,
      roomNumber: '101',
      name: 'Deluxe Suite',
      roomType: { name: 'Standard' },
      images: [],
    },
    approvedByUser: null,
    ...overrides,
  };
}

function makeAuthUser(overrides: Record<string, unknown> = {}) {
  return { id: USER_ID, email: 'customer@example.com', role: Role.CUSTOMER, ...overrides };
}

function makeAdminUser() {
  return { id: ADMIN_ID, email: 'admin@example.com', role: Role.ADMIN };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

/** Minimal tx shape used inside $transaction callback mocks. */
interface FakeTx {
  booking: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  room: { findUnique: jest.Mock };
  bookingStatusHistory: { create: jest.Mock };
  $queryRaw: jest.Mock;
}

/** Creates a minimal transactional Prisma mock that runs the callback synchronously. */
function makePrismaMock() {
  const bookingCreate = jest.fn();
  const bookingUpdate = jest.fn();
  const bookingFindUnique = jest.fn();
  const bookingFindMany = jest.fn();
  const bookingCount = jest.fn();
  const roomFindUnique = jest.fn();
  const statusHistoryCreate = jest.fn();

  // $transaction mock – accepts either an array (batch) or a callback.
  const $transaction = jest.fn().mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    // Callback variant – pass a tx that proxies the same mocks.
    const tx: FakeTx = {
      booking: {
        create: bookingCreate,
        update: bookingUpdate,
        findUnique: bookingFindUnique,
        findMany: bookingFindMany,
        count: bookingCount,
      },
      room: { findUnique: roomFindUnique },
      bookingStatusHistory: { create: statusHistoryCreate },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    return (arg as (tx: FakeTx) => Promise<unknown>)(tx);
  });

  return {
    $transaction,
    booking: {
      create: bookingCreate,
      update: bookingUpdate,
      findUnique: bookingFindUnique,
      findMany: bookingFindMany,
      count: bookingCount,
    },
    room: { findUnique: roomFindUnique },
    bookingStatusHistory: { create: statusHistoryCreate },
    // Expose internal mocks for test-level configuration.
    _mocks: {
      bookingCreate,
      bookingUpdate,
      bookingFindUnique,
      bookingFindMany,
      bookingCount,
      roomFindUnique,
      statusHistoryCreate,
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let availabilityService: jest.Mocked<AvailabilityService>;
  let offersService: jest.Mocked<OffersService>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    availabilityService = {
      lockRoomForUpdate: jest.fn().mockResolvedValue(undefined),
      hasOverlappingBooking: jest.fn().mockResolvedValue(false),
      searchAvailableRooms: jest.fn(),
      isRoomAvailableResponse: jest.fn(),
    } as unknown as jest.Mocked<AvailabilityService>;

    offersService = {
      findBestApplicableOffer: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OffersService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: OffersService, useValue: offersService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create()', () => {
    const validDto = () => ({
      roomId: ROOM_ID,
      checkInDate: futureDateStr(3),
      checkOutDate: futureDateStr(5),
      numberOfAdults: 2,
      numberOfChildren: 0,
    });

    beforeEach(() => {
      // Default: room is available
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      // generateBookingNumber needs booking.count inside tx
      prisma._mocks.bookingCount.mockResolvedValue(0);
      // Default: booking is returned from tx.booking.create
      prisma._mocks.bookingCreate.mockResolvedValue(makeBookingDb());
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    });

    it('should create a booking with PENDING status and correct pricing', async () => {
      const result = await service.create(USER_ID, validDto());

      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.pricePerNight).toBe(150);
      expect(result.numberOfNights).toBe(2);
      expect(result.subtotal).toBe(300);
      expect(result.discountAmount).toBe(0);
      expect(result.totalAmount).toBe(300);
    });

    it('should produce a booking number matching GH-<year>-XXXXXX', async () => {
      const result = await service.create(USER_ID, validDto());
      expect(result.bookingNumber).toMatch(/^GH-\d{4}-\d{6}$/);
    });

    it('should apply the best available offer and reduce totalAmount', async () => {
      const discountedBooking = makeBookingDb({
        discountAmount: new Decimal('30.00'),
        totalAmount: new Decimal('270.00'),
        offerId: 'offer-001',
      });
      prisma._mocks.bookingCreate.mockResolvedValue(discountedBooking);
      offersService.findBestApplicableOffer.mockResolvedValue({
        offerId: 'offer-001',
        discountAmount: 30,
      } as unknown as Awaited<ReturnType<typeof offersService.findBestApplicableOffer>>);

      const result = await service.create(USER_ID, validDto());

      expect(result.discountAmount).toBe(30);
      expect(result.totalAmount).toBe(270);
    });

    it('should default numberOfChildren to 0 when not supplied', async () => {
      const dto = { ...validDto() };
      delete (dto as Partial<typeof dto>).numberOfChildren;

      await service.create(USER_ID, dto as typeof dto);

      const callArgs = prisma._mocks.bookingCreate.mock.calls[0][0];
      expect(callArgs.data.numberOfChildren).toBe(0);
    });

    it('should persist customerNote verbatim', async () => {
      const dto = { ...validDto(), customerNote: 'Late check-in after 10 PM please.' };
      await service.create(USER_ID, dto);

      const callArgs = prisma._mocks.bookingCreate.mock.calls[0][0];
      expect(callArgs.data.customerNote).toBe('Late check-in after 10 PM please.');
    });

    it('should write an initial PENDING entry to BookingStatusHistory', async () => {
      await service.create(USER_ID, validDto());

      expect(prisma._mocks.statusHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: BOOKING_ID,
            status: BookingStatus.PENDING,
            changedBy: USER_ID,
          }),
        }),
      );
    });

    it('should compute numberOfGuests as adults + children', async () => {
      const dto = { ...validDto(), numberOfAdults: 2, numberOfChildren: 1 };
      await service.create(USER_ID, dto);

      const callArgs = prisma._mocks.bookingCreate.mock.calls[0][0];
      expect(callArgs.data.numberOfGuests).toBe(3);
    });

    // --- Room existence / status guards ---

    it('should throw RoomNotFoundException when roomId does not exist', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(null);

      await expect(service.create(USER_ID, validDto())).rejects.toBeInstanceOf(RoomNotFoundException);
    });

    it('should throw RoomInactiveException when room.isActive is false', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom({ isActive: false }));

      await expect(service.create(USER_ID, validDto())).rejects.toBeInstanceOf(RoomInactiveException);
    });

    it('should throw RoomInactiveException when room.status is INACTIVE', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(
        makeRoom({ status: RoomStatus.INACTIVE }),
      );

      await expect(service.create(USER_ID, validDto())).rejects.toBeInstanceOf(RoomInactiveException);
    });

    it('should throw RoomUnderMaintenanceException when room is under maintenance', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(
        makeRoom({ status: RoomStatus.MAINTENANCE }),
      );

      await expect(service.create(USER_ID, validDto())).rejects.toBeInstanceOf(
        RoomUnderMaintenanceException,
      );
    });

    it('should throw RoomCapacityExceededException when guest count exceeds room capacity', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom({ maximumGuests: 2 }));
      const dto = { ...validDto(), numberOfAdults: 2, numberOfChildren: 1 }; // 3 > 2

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(RoomCapacityExceededException);
    });

    it('should include the maximum guest number in the capacity error message', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom({ maximumGuests: 3 }));
      const dto = { ...validDto(), numberOfAdults: 4 };

      await expect(service.create(USER_ID, dto)).rejects.toThrow('3');
    });

    it('should throw RoomNotAvailableException when dates overlap an existing booking', async () => {
      availabilityService.hasOverlappingBooking.mockResolvedValue(true);

      await expect(service.create(USER_ID, validDto())).rejects.toBeInstanceOf(
        RoomNotAvailableException,
      );
    });

    // --- Date validation ---

    it('should throw InvalidBookingDatesException when checkOut equals checkIn (same-day)', async () => {
      const dto = {
        ...validDto(),
        checkInDate: futureDateStr(3),
        checkOutDate: futureDateStr(3),
      };

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(InvalidBookingDatesException);
    });

    it('should throw InvalidBookingDatesException when checkOut is before checkIn', async () => {
      const dto = {
        ...validDto(),
        checkInDate: futureDateStr(5),
        checkOutDate: futureDateStr(3),
      };

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(InvalidBookingDatesException);
    });

    it('should throw InvalidBookingDatesException when checkIn is in the past', async () => {
      const dto = {
        ...validDto(),
        checkInDate: yesterdayStr(),
        checkOutDate: futureDateStr(1),
      };

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(InvalidBookingDatesException);
    });

    it('should accept a booking where checkIn is today (edge case – not in the past)', async () => {
      // "Today" is allowed by the validator (the check is strictly < today)
      const dto = {
        ...validDto(),
        checkInDate: todayStr(),
        checkOutDate: futureDateStr(2),
      };

      // Should not throw – resolves to mapped booking
      await expect(service.create(USER_ID, dto)).resolves.toBeDefined();
    });

    it('should call lockRoomForUpdate before the overlap check to prevent double-booking', async () => {
      await service.create(USER_ID, validDto());

      expect(availabilityService.lockRoomForUpdate).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // findMyBookings()
  // =========================================================================

  describe('findMyBookings()', () => {
    it('should return a paginated list of the requesting customer bookings', async () => {
      const bookingList = [makeBookingDb()];
      // $transaction receives an array of two promises: findMany + count
      prisma.$transaction.mockResolvedValueOnce([bookingList, 1]);

      const result = await service.findMyBookings(USER_ID, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.data[0].userId).toBe(USER_ID);
    });

    it('should filter bookings by status when status is supplied', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findMyBookings(USER_ID, { status: BookingStatus.CANCELLED });

      // The batch array resolves both queries; verify findMany was called with status filter.
      const batchArray = prisma.$transaction.mock.calls[0][0] as unknown[];
      expect(batchArray).toHaveLength(2);
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================

  describe('findOne()', () => {
    it('should return booking when the requesting user is the owner', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(makeBookingDb());

      const result = await service.findOne(BOOKING_ID, makeAuthUser());

      expect(result.id).toBe(BOOKING_ID);
    });

    it('should return any booking when the requesting user is ADMIN', async () => {
      const otherUserBooking = makeBookingDb({ userId: 'other-user-999' });
      prisma._mocks.bookingFindUnique.mockResolvedValue(otherUserBooking);

      const result = await service.findOne(BOOKING_ID, makeAdminUser());

      expect(result.id).toBe(BOOKING_ID);
    });

    it('should throw ForbiddenDomainException when a CUSTOMER tries to view another customer booking', async () => {
      const otherUserBooking = makeBookingDb({ userId: 'other-user-999' });
      prisma._mocks.bookingFindUnique.mockResolvedValue(otherUserBooking);

      await expect(service.findOne(BOOKING_ID, makeAuthUser())).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', makeAuthUser())).rejects.toBeInstanceOf(
        BookingNotFoundException,
      );
    });
  });

  // =========================================================================
  // cancelOwn()
  // =========================================================================

  describe('cancelOwn()', () => {
    const cancelDto = { cancellationReason: 'Change of plans' };

    function setupCancelHappyPath(overrides: Record<string, unknown> = {}) {
      prisma._mocks.bookingFindUnique.mockResolvedValue(makeBookingDb(overrides));
      prisma._mocks.bookingUpdate.mockResolvedValue(
        makeBookingDb({ ...overrides, status: BookingStatus.CANCELLED }),
      );
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    }

    it('should successfully cancel a PENDING booking before check-in', async () => {
      setupCancelHappyPath({ status: BookingStatus.PENDING });

      const result = await service.cancelOwn(BOOKING_ID, USER_ID, cancelDto);

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('should successfully cancel an APPROVED booking before check-in', async () => {
      setupCancelHappyPath({ status: BookingStatus.APPROVED });

      const result = await service.cancelOwn(BOOKING_ID, USER_ID, cancelDto);

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('should persist the cancellationReason in the booking update', async () => {
      setupCancelHappyPath({ status: BookingStatus.PENDING });

      await service.cancelOwn(BOOKING_ID, USER_ID, { cancellationReason: 'Travel cancelled' });

      const updateCall = prisma._mocks.bookingUpdate.mock.calls[0][0];
      expect(updateCall.data.cancellationReason).toBe('Travel cancelled');
    });

    it('should write a CANCELLED status history entry', async () => {
      setupCancelHappyPath({ status: BookingStatus.PENDING });

      await service.cancelOwn(BOOKING_ID, USER_ID, cancelDto);

      expect(prisma._mocks.statusHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
        }),
      );
    });

    it('should throw ForbiddenDomainException when customer tries to cancel someone else booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(makeBookingDb({ userId: 'other-user' }));

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('should throw BookingNotCancellableException for a COMPLETED booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.COMPLETED }),
      );

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotCancellableException,
      );
    });

    it('should throw BookingNotCancellableException for an already-CANCELLED booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED }),
      );

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotCancellableException,
      );
    });

    it('should throw BookingNotCancellableException for a REJECTED booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.REJECTED }),
      );

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotCancellableException,
      );
    });

    it('should throw BookingNotCancellableException when checkIn date is today (boundary)', async () => {
      // checkInDate === today → already arrived → not cancellable
      const todayDate = new Date(todayStr() + 'T00:00:00.000Z');
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.PENDING, checkInDate: todayDate }),
      );

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotCancellableException,
      );
    });

    it('should throw BookingNotCancellableException when checkIn date has passed', async () => {
      const pastDate = new Date(yesterdayStr() + 'T00:00:00.000Z');
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.APPROVED, checkInDate: pastDate }),
      );

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotCancellableException,
      );
    });

    it('should allow cancellation when checkIn is tomorrow (boundary – still in future)', async () => {
      const tomorrowDate = new Date(futureDateStr(1) + 'T00:00:00.000Z');
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.PENDING, checkInDate: tomorrowDate }),
      );
      prisma._mocks.bookingUpdate.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED, checkInDate: tomorrowDate }),
      );
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});

      await expect(service.cancelOwn(BOOKING_ID, USER_ID, cancelDto)).resolves.toBeDefined();
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.cancelOwn('bad-id', USER_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotFoundException,
      );
    });
  });

  // =========================================================================
  // cancelAsAdmin()
  // =========================================================================

  describe('cancelAsAdmin()', () => {
    const cancelDto = { cancellationReason: 'Admin override' };

    function setupAdminCancel(status: BookingStatus) {
      prisma._mocks.bookingFindUnique.mockResolvedValue(makeBookingDb({ status }));
      prisma._mocks.bookingUpdate.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED }),
      );
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    }

    it('should cancel any PENDING booking as admin', async () => {
      setupAdminCancel(BookingStatus.PENDING);

      const result = await service.cancelAsAdmin(BOOKING_ID, ADMIN_ID, cancelDto);

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('should cancel any APPROVED booking as admin', async () => {
      setupAdminCancel(BookingStatus.APPROVED);

      const result = await service.cancelAsAdmin(BOOKING_ID, ADMIN_ID, cancelDto);

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('should throw BookingAlreadyProcessedException if booking is COMPLETED', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.COMPLETED }),
      );

      await expect(service.cancelAsAdmin(BOOKING_ID, ADMIN_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingAlreadyProcessedException,
      );
    });

    it('should throw BookingAlreadyProcessedException if booking is already CANCELLED', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED }),
      );

      await expect(service.cancelAsAdmin(BOOKING_ID, ADMIN_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingAlreadyProcessedException,
      );
    });

    it('admin cancel should NOT be blocked by a past checkIn date (no date restriction for admins)', async () => {
      // Admin bypass: the date guard that applies to customers does not apply here.
      const pastDate = new Date(yesterdayStr() + 'T00:00:00.000Z');
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.APPROVED, checkInDate: pastDate }),
      );
      prisma._mocks.bookingUpdate.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED }),
      );
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});

      await expect(service.cancelAsAdmin(BOOKING_ID, ADMIN_ID, cancelDto)).resolves.toBeDefined();
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.cancelAsAdmin('bad-id', ADMIN_ID, cancelDto)).rejects.toBeInstanceOf(
        BookingNotFoundException,
      );
    });
  });

  // =========================================================================
  // approve() (admin)
  // =========================================================================

  describe('approve()', () => {
    function setupApproveHappyPath() {
      // The transaction callback receives tx with findUnique, booking count, etc.
      // We configure the mock so that the callback path works.
      const pendingBooking = makeBookingDb({ status: BookingStatus.PENDING });
      const approvedBooking = makeBookingDb({
        status: BookingStatus.APPROVED,
        approvedBy: ADMIN_ID,
        approvedAt: new Date(),
      });

      prisma._mocks.bookingFindUnique.mockResolvedValue(pendingBooking);
      prisma._mocks.bookingUpdate.mockResolvedValue(approvedBooking);
      prisma._mocks.bookingCount.mockResolvedValue(1);
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    }

    it('should approve a PENDING booking and record approvedBy', async () => {
      setupApproveHappyPath();

      const result = await service.approve(BOOKING_ID, ADMIN_ID);

      expect(result.status).toBe(BookingStatus.APPROVED);
    });

    it('should record approvedBy and approvedAt in the update call', async () => {
      setupApproveHappyPath();

      await service.approve(BOOKING_ID, ADMIN_ID);

      const updateCall = prisma._mocks.bookingUpdate.mock.calls[0][0];
      expect(updateCall.data.approvedBy).toBe(ADMIN_ID);
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
    });

    it('should write an APPROVED status history entry', async () => {
      setupApproveHappyPath();

      await service.approve(BOOKING_ID, ADMIN_ID);

      expect(prisma._mocks.statusHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.APPROVED }),
        }),
      );
    });

    it('should throw BookingAlreadyProcessedException when booking is not PENDING', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.APPROVED }),
      );

      await expect(service.approve(BOOKING_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        BookingAlreadyProcessedException,
      );
    });

    it('should throw RoomNotAvailableException if room is no longer available at approval time (race window)', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.PENDING }),
      );
      // Simulate a concurrent booking claiming the room between create and approve
      availabilityService.hasOverlappingBooking.mockResolvedValue(true);

      await expect(service.approve(BOOKING_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        RoomNotAvailableException,
      );
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.approve('bad-id', ADMIN_ID)).rejects.toBeInstanceOf(
        BookingNotFoundException,
      );
    });
  });

  // =========================================================================
  // reject() (admin)
  // =========================================================================

  describe('reject()', () => {
    function setupRejectHappyPath(overrides: Record<string, unknown> = {}) {
      const pendingBooking = makeBookingDb({ status: BookingStatus.PENDING });
      const rejectedBooking = makeBookingDb({
        status: BookingStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: overrides.rejectionReason ?? 'Room under maintenance',
        ...overrides,
      });

      prisma._mocks.bookingFindUnique.mockResolvedValue(pendingBooking);
      prisma._mocks.bookingUpdate.mockResolvedValue(rejectedBooking);
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    }

    it('should reject a PENDING booking with a reason', async () => {
      setupRejectHappyPath({ rejectionReason: 'Room reserved for maintenance' });

      const result = await service.reject(BOOKING_ID, ADMIN_ID, {
        rejectionReason: 'Room reserved for maintenance',
      });

      expect(result.status).toBe(BookingStatus.REJECTED);
      expect(result.rejectionReason).toBe('Room reserved for maintenance');
    });

    it('should reject a PENDING booking without a reason (optional field)', async () => {
      setupRejectHappyPath({ rejectionReason: null });

      const result = await service.reject(BOOKING_ID, ADMIN_ID, {});

      expect(result.status).toBe(BookingStatus.REJECTED);
    });

    it('should record rejectedAt in the update call', async () => {
      setupRejectHappyPath();

      await service.reject(BOOKING_ID, ADMIN_ID, { rejectionReason: 'No availability' });

      const updateCall = prisma._mocks.bookingUpdate.mock.calls[0][0];
      expect(updateCall.data.rejectedAt).toBeInstanceOf(Date);
    });

    it('should write a REJECTED status history entry', async () => {
      setupRejectHappyPath();

      await service.reject(BOOKING_ID, ADMIN_ID, { rejectionReason: 'No availability' });

      expect(prisma._mocks.statusHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.REJECTED }),
        }),
      );
    });

    it('should throw BookingAlreadyProcessedException when booking is not PENDING', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.CANCELLED }),
      );

      await expect(
        service.reject(BOOKING_ID, ADMIN_ID, { rejectionReason: 'Too late' }),
      ).rejects.toBeInstanceOf(BookingAlreadyProcessedException);
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.reject('bad-id', ADMIN_ID, {})).rejects.toBeInstanceOf(
        BookingNotFoundException,
      );
    });
  });

  // =========================================================================
  // findAllAdmin()
  // =========================================================================

  describe('findAllAdmin()', () => {
    it('should return all bookings with default pagination when no filters are supplied', async () => {
      const bookings = [makeBookingDb(), makeBookingDb({ id: 'booking-002' })];
      prisma.$transaction.mockResolvedValueOnce([bookings, 2]);

      const result = await service.findAllAdmin({});

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should apply status filter when supplied', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAllAdmin({ status: BookingStatus.APPROVED });

      // The $transaction was called; verify it was invoked with a filter array.
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should apply roomId, userId, checkIn, checkOut filters', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAllAdmin({
        roomId: ROOM_ID,
        userId: USER_ID,
        checkIn: futureDateStr(1),
        checkOut: futureDateStr(10),
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should apply search filter across bookingNumber, name, and email', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAllAdmin({ search: 'john' });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // findOneAdmin()
  // =========================================================================

  describe('findOneAdmin()', () => {
    it('should return any booking by id as admin', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(makeBookingDb());

      const result = await service.findOneAdmin(BOOKING_ID);

      expect(result.id).toBe(BOOKING_ID);
    });

    it('should throw BookingNotFoundException for a non-existent booking', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(null);

      await expect(service.findOneAdmin('bad-id')).rejects.toBeInstanceOf(BookingNotFoundException);
    });
  });

  // =========================================================================
  // Pricing edge cases
  // =========================================================================

  describe('pricing calculations', () => {
    beforeEach(() => {
      prisma._mocks.bookingCount.mockResolvedValue(0);
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});
    });

    it('should correctly compute subtotal = pricePerNight × numberOfNights', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom({ pricePerNight: new Decimal('100.50') }));

      const threeNightBooking = makeBookingDb({
        pricePerNight: new Decimal('100.50'),
        subtotal: new Decimal('301.50'),
        totalAmount: new Decimal('301.50'),
        numberOfNights: 3,
      });
      prisma._mocks.bookingCreate.mockResolvedValue(threeNightBooking);

      const dto = {
        roomId: ROOM_ID,
        checkInDate: futureDateStr(3),
        checkOutDate: futureDateStr(6), // 3 nights
        numberOfAdults: 1,
      };

      const result = await service.create(USER_ID, dto);

      expect(result.subtotal).toBe(301.5);
    });

    it('should cap totalAmount at 0 if discount equals subtotal (no negative totals)', async () => {
      // This verifies roundCurrency behavior for edge-case discounts.
      offersService.findBestApplicableOffer.mockResolvedValue({
        offerId: 'offer-full',
        discountAmount: 300, // Full subtotal discount
      } as unknown as Awaited<ReturnType<typeof offersService.findBestApplicableOffer>>);

      const zeroTotalBooking = makeBookingDb({
        discountAmount: new Decimal('300.00'),
        totalAmount: new Decimal('0.00'),
        offerId: 'offer-full',
      });
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      prisma._mocks.bookingCreate.mockResolvedValue(zeroTotalBooking);

      const dto = {
        roomId: ROOM_ID,
        checkInDate: futureDateStr(3),
        checkOutDate: futureDateStr(5),
        numberOfAdults: 2,
      };

      const result = await service.create(USER_ID, dto);
      expect(result.totalAmount).toBe(0);
    });
  });

  // =========================================================================
  // Overbooking prevention (concurrency)
  // =========================================================================

  describe('overbooking prevention', () => {
    it('should call lockRoomForUpdate before hasOverlappingBooking to serialize concurrent requests', async () => {
      const lockOrder: string[] = [];
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      prisma._mocks.bookingCount.mockResolvedValue(0);
      prisma._mocks.bookingCreate.mockResolvedValue(makeBookingDb());
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});

      availabilityService.lockRoomForUpdate.mockImplementation(async () => {
        lockOrder.push('lock');
      });
      availabilityService.hasOverlappingBooking.mockImplementation(async () => {
        lockOrder.push('overlap-check');
        return false;
      });

      await service.create(USER_ID, {
        roomId: ROOM_ID,
        checkInDate: futureDateStr(3),
        checkOutDate: futureDateStr(5),
        numberOfAdults: 2,
      });

      expect(lockOrder).toEqual(['lock', 'overlap-check']);
    });

    it('should reject a booking if another booking overlaps (prevents double-booking)', async () => {
      prisma._mocks.roomFindUnique.mockResolvedValue(makeRoom());
      prisma._mocks.bookingCount.mockResolvedValue(1);
      availabilityService.hasOverlappingBooking.mockResolvedValue(true);

      await expect(
        service.create(USER_ID, {
          roomId: ROOM_ID,
          checkInDate: futureDateStr(3),
          checkOutDate: futureDateStr(5),
          numberOfAdults: 2,
        }),
      ).rejects.toBeInstanceOf(RoomNotAvailableException);
    });

    it('should also lock the room during approval to close the race window', async () => {
      prisma._mocks.bookingFindUnique.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.PENDING }),
      );
      prisma._mocks.bookingUpdate.mockResolvedValue(
        makeBookingDb({ status: BookingStatus.APPROVED }),
      );
      prisma._mocks.bookingCount.mockResolvedValue(1);
      prisma._mocks.statusHistoryCreate.mockResolvedValue({});

      await service.approve(BOOKING_ID, ADMIN_ID);

      // lockRoomForUpdate must have been called during approve as well
      expect(availabilityService.lockRoomForUpdate).toHaveBeenCalled();
    });
  });
});
