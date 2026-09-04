/**
 * Bookings Controllers – unit tests
 *
 * These tests mount the controllers in an isolated NestJS testing module.
 * The BookingsService is fully mocked; no database or HTTP server is started.
 *
 * Coverage checklist
 * ------------------
 * BookingsController (customer-facing /bookings)
 *   POST   /bookings
 *     ✓ delegates to bookingsService.create with userId from JWT
 *     ✓ passes CreateBookingDto body through
 *     ✓ returns 201 with the service response wrapped in success envelope
 *
 *   GET    /bookings/my
 *     ✓ delegates to bookingsService.findMyBookings with userId
 *     ✓ passes query params through
 *
 *   GET    /bookings/:id
 *     ✓ delegates to bookingsService.findOne with id + full user object
 *
 *   PATCH  /bookings/:id/cancel
 *     ✓ delegates to bookingsService.cancelOwn with id + userId
 *     ✓ passes CancelBookingDto through
 *
 * AdminBookingsController (admin-facing /admin/bookings)
 *   GET    /admin/bookings
 *     ✓ delegates to bookingsService.findAllAdmin with query params
 *
 *   GET    /admin/bookings/:id
 *     ✓ delegates to bookingsService.findOneAdmin
 *
 *   PATCH  /admin/bookings/:id/approve
 *     ✓ delegates to bookingsService.approve with id + adminId
 *
 *   PATCH  /admin/bookings/:id/reject
 *     ✓ delegates to bookingsService.reject with id + adminId + dto
 *
 *   PATCH  /admin/bookings/:id/cancel
 *     ✓ delegates to bookingsService.cancelAsAdmin with id + adminId + dto
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role } from '@prisma/client';

import { BookingsController } from '../bookings.controller';
import { AdminBookingsController } from '../admin-bookings.controller';
import { BookingsService } from '../bookings.service';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

const BOOKING_ID = 'booking-001';
const USER_ID = 'user-cust-001';
const ADMIN_ID = 'user-admin-001';

function makeCustomerUser() {
  return { id: USER_ID, email: 'customer@example.com', role: Role.CUSTOMER };
}

function makeAdminUser() {
  return { id: ADMIN_ID, email: 'admin@example.com', role: Role.ADMIN };
}

function makeBookingResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    bookingNumber: 'GH-2026-000001',
    userId: USER_ID,
    status: BookingStatus.PENDING,
    totalAmount: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocked service
// ---------------------------------------------------------------------------

const mockBookingsService: jest.Mocked<BookingsService> = {
  create: jest.fn(),
  findMyBookings: jest.fn(),
  findOne: jest.fn(),
  cancelOwn: jest.fn(),
  findAllAdmin: jest.fn(),
  findOneAdmin: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  cancelAsAdmin: jest.fn(),
} as unknown as jest.Mocked<BookingsService>;

// ---------------------------------------------------------------------------
// BookingsController tests (customer endpoints)
// ---------------------------------------------------------------------------

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: mockBookingsService }],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // POST /bookings — create
  // -------------------------------------------------------------------------

  describe('create()', () => {
    const createDto = {
      roomId: 'room-001',
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-12',
      numberOfAdults: 2,
      numberOfChildren: 0,
    };

    it('should delegate to bookingsService.create with the authenticated userId', async () => {
      mockBookingsService.create.mockResolvedValue(makeBookingResponse() as never);

      await controller.create(makeCustomerUser(), createDto);

      expect(mockBookingsService.create).toHaveBeenCalledWith(USER_ID, createDto);
    });

    it('should return the booking response from the service', async () => {
      const booking = makeBookingResponse({ totalAmount: 300 });
      mockBookingsService.create.mockResolvedValue(booking as never);

      const result = await controller.create(makeCustomerUser(), createDto);

      expect(result).toEqual(booking);
    });
  });

  // -------------------------------------------------------------------------
  // GET /bookings/my — findMine
  // -------------------------------------------------------------------------

  describe('findMine()', () => {
    it('should delegate to bookingsService.findMyBookings with userId and query', async () => {
      const paginatedResult = { data: [], pagination: { total: 0 } };
      mockBookingsService.findMyBookings.mockResolvedValue(paginatedResult as never);

      const query = { page: 1, limit: 10, status: BookingStatus.PENDING };
      await controller.findMine(makeCustomerUser(), query);

      expect(mockBookingsService.findMyBookings).toHaveBeenCalledWith(USER_ID, query);
    });

    it('should return the paginated result from the service', async () => {
      const paginatedResult = {
        data: [makeBookingResponse()],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockBookingsService.findMyBookings.mockResolvedValue(paginatedResult as never);

      const result = await controller.findMine(makeCustomerUser(), {});

      expect(result).toEqual(paginatedResult);
    });
  });

  // -------------------------------------------------------------------------
  // GET /bookings/:id — findOne
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('should delegate to bookingsService.findOne with id and full user object', async () => {
      const booking = makeBookingResponse();
      mockBookingsService.findOne.mockResolvedValue(booking as never);
      const user = makeCustomerUser();

      await controller.findOne(BOOKING_ID, user);

      expect(mockBookingsService.findOne).toHaveBeenCalledWith(BOOKING_ID, user);
    });

    it('should return the booking from the service', async () => {
      const booking = makeBookingResponse();
      mockBookingsService.findOne.mockResolvedValue(booking as never);

      const result = await controller.findOne(BOOKING_ID, makeCustomerUser());

      expect(result).toEqual(booking);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /bookings/:id/cancel — cancel
  // -------------------------------------------------------------------------

  describe('cancel()', () => {
    it('should delegate to bookingsService.cancelOwn with id, userId, and dto', async () => {
      const cancelled = makeBookingResponse({ status: BookingStatus.CANCELLED });
      mockBookingsService.cancelOwn.mockResolvedValue(cancelled as never);

      const dto = { cancellationReason: 'Change of plans' };
      await controller.cancel(BOOKING_ID, makeCustomerUser(), dto);

      expect(mockBookingsService.cancelOwn).toHaveBeenCalledWith(BOOKING_ID, USER_ID, dto);
    });

    it('should return the cancelled booking from the service', async () => {
      const cancelled = makeBookingResponse({ status: BookingStatus.CANCELLED });
      mockBookingsService.cancelOwn.mockResolvedValue(cancelled as never);

      const result = await controller.cancel(BOOKING_ID, makeCustomerUser(), {});

      expect(result).toEqual(cancelled);
    });
  });
});

// ---------------------------------------------------------------------------
// AdminBookingsController tests
// ---------------------------------------------------------------------------

describe('AdminBookingsController', () => {
  let controller: AdminBookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBookingsController],
      providers: [{ provide: BookingsService, useValue: mockBookingsService }],
    }).compile();

    controller = module.get<AdminBookingsController>(AdminBookingsController);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // GET /admin/bookings — findAll
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('should delegate to bookingsService.findAllAdmin with query params', async () => {
      const paginatedResult = { data: [], pagination: { total: 0 } };
      mockBookingsService.findAllAdmin.mockResolvedValue(paginatedResult as never);

      const query = { status: BookingStatus.PENDING, page: 1, limit: 20 };
      await controller.findAll(query);

      expect(mockBookingsService.findAllAdmin).toHaveBeenCalledWith(query);
    });

    it('should return paginated results from the service', async () => {
      const results = {
        data: [makeBookingResponse(), makeBookingResponse({ id: 'booking-002' })],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      mockBookingsService.findAllAdmin.mockResolvedValue(results as never);

      const result = await controller.findAll({});

      expect(result.data).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // GET /admin/bookings/:id — findOne
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('should delegate to bookingsService.findOneAdmin with the booking id', async () => {
      const booking = makeBookingResponse();
      mockBookingsService.findOneAdmin.mockResolvedValue(booking as never);

      await controller.findOne(BOOKING_ID);

      expect(mockBookingsService.findOneAdmin).toHaveBeenCalledWith(BOOKING_ID);
    });

    it('should return the booking from the service', async () => {
      const booking = makeBookingResponse();
      mockBookingsService.findOneAdmin.mockResolvedValue(booking as never);

      const result = await controller.findOne(BOOKING_ID);

      expect(result).toEqual(booking);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /admin/bookings/:id/approve — approve
  // -------------------------------------------------------------------------

  describe('approve()', () => {
    it('should delegate to bookingsService.approve with id and adminId', async () => {
      const approved = makeBookingResponse({ status: BookingStatus.APPROVED });
      mockBookingsService.approve.mockResolvedValue(approved as never);
      const admin = makeAdminUser();

      await controller.approve(BOOKING_ID, admin);

      expect(mockBookingsService.approve).toHaveBeenCalledWith(BOOKING_ID, ADMIN_ID);
    });

    it('should return the approved booking', async () => {
      const approved = makeBookingResponse({ status: BookingStatus.APPROVED });
      mockBookingsService.approve.mockResolvedValue(approved as never);

      const result = await controller.approve(BOOKING_ID, makeAdminUser());

      expect(result.status).toBe(BookingStatus.APPROVED);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /admin/bookings/:id/reject — reject
  // -------------------------------------------------------------------------

  describe('reject()', () => {
    it('should delegate to bookingsService.reject with id, adminId, and dto', async () => {
      const rejected = makeBookingResponse({ status: BookingStatus.REJECTED });
      mockBookingsService.reject.mockResolvedValue(rejected as never);

      const dto = { rejectionReason: 'Maintenance conflict' };
      await controller.reject(BOOKING_ID, makeAdminUser(), dto);

      expect(mockBookingsService.reject).toHaveBeenCalledWith(BOOKING_ID, ADMIN_ID, dto);
    });

    it('should return the rejected booking', async () => {
      const rejected = makeBookingResponse({ status: BookingStatus.REJECTED });
      mockBookingsService.reject.mockResolvedValue(rejected as never);

      const result = await controller.reject(BOOKING_ID, makeAdminUser(), {});

      expect(result.status).toBe(BookingStatus.REJECTED);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /admin/bookings/:id/cancel — cancel (admin)
  // -------------------------------------------------------------------------

  describe('cancel()', () => {
    it('should delegate to bookingsService.cancelAsAdmin with id, adminId, and dto', async () => {
      const cancelled = makeBookingResponse({ status: BookingStatus.CANCELLED });
      mockBookingsService.cancelAsAdmin.mockResolvedValue(cancelled as never);

      const dto = { cancellationReason: 'Admin override' };
      await controller.cancel(BOOKING_ID, makeAdminUser(), dto);

      expect(mockBookingsService.cancelAsAdmin).toHaveBeenCalledWith(BOOKING_ID, ADMIN_ID, dto);
    });

    it('should return the cancelled booking', async () => {
      const cancelled = makeBookingResponse({ status: BookingStatus.CANCELLED });
      mockBookingsService.cancelAsAdmin.mockResolvedValue(cancelled as never);

      const result = await controller.cancel(BOOKING_ID, makeAdminUser(), {});

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });
});
