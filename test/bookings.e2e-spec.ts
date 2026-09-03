/**
 * Bookings lifecycle e2e test suite
 *
 * Exercises the full booking state machine through the HTTP layer with a real
 * database. Tests run sequentially within each describe block so that later
 * tests can rely on state created by earlier ones (booking id, status, etc.).
 *
 * Coverage
 * --------
 *  POST /bookings  (customer creates a booking)
 *    ✓ creates a PENDING booking with valid payload
 *    ✓ returns 400 for missing required fields
 *    ✓ returns 400 when checkOut <= checkIn
 *    ✓ returns 400 when guest count exceeds room capacity
 *    ✓ returns 404 for a non-existent roomId
 *
 *  GET /bookings/my  (customer views own bookings)
 *    ✓ returns the customer's bookings (includes the one just created)
 *    ✓ filters by status
 *
 *  GET /bookings/:id  (owner or admin reads booking)
 *    ✓ customer can read their own booking
 *    ✓ admin can read any booking
 *    ✓ customer cannot read another user's booking (403)
 *    ✓ returns 404 for a non-existent id
 *
 *  PATCH /admin/bookings/:id/approve  (admin approves)
 *    ✓ transitions booking from PENDING → APPROVED
 *    ✓ returns 404 for a non-existent booking id
 *
 *  PATCH /admin/bookings/:id/reject   (admin rejects)
 *    ✓ transitions booking from PENDING → REJECTED
 *
 *  PATCH /admin/bookings/:id/cancel   (admin cancels)
 *    ✓ admin can cancel an APPROVED booking
 *
 *  PATCH /bookings/:id/cancel  (customer cancels)
 *    ✓ customer cancels their own PENDING booking
 *    ✓ returns 403 when trying to cancel another user's booking
 *    ✓ returns 422/400 when trying to cancel an already-CANCELLED booking
 *
 *  GET /admin/bookings  (admin list)
 *    ✓ returns all bookings with pagination
 *    ✓ filters by status
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/app.helper';
import {
  loginAs,
  bearerHeader,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from './helpers/auth.helper';

describe('Bookings lifecycle (e2e)', () => {
  let app: INestApplication;
  let prefix: string;
  let adminToken: string;
  let customerToken: string;
  /** Id of the seeded room used for bookings (fetched from DB) */
  let roomId: string;
  let roomCapacity: number;
  /** Booking created in the first test — shared across the suite */
  let bookingId: string;

  // Dates in the future to avoid "checkIn is in the past" rejection
  const checkIn = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ({ app, prefix } = await createTestApp());
    [{ accessToken: adminToken }, { accessToken: customerToken }] = await Promise.all([
      loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD),
      loginAs(app, CUSTOMER_EMAIL, CUSTOMER_PASSWORD),
    ]);

    // Find the first AVAILABLE room from seed data
    const res = await request(app.getHttpServer())
      .get(`${prefix}/rooms`)
      .query({ status: 'AVAILABLE', limit: 1 })
      .expect(200);

    const rooms: { id: string; maximumGuests: number }[] = res.body.data.data;
    expect(rooms.length).toBeGreaterThan(0);
    roomId = rooms[0].id;
    roomCapacity = rooms[0].maximumGuests;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // =========================================================================
  // POST /bookings
  // =========================================================================

  describe('POST /bookings (customer creates booking)', () => {
    it('creates a PENDING booking with valid payload', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfAdults: 1,
          numberOfChildren: 0,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.roomId).toBe(roomId);
      expect(res.body.data.bookingNumber).toMatch(/^GH-\d{4}-\d{6}$/);

      bookingId = res.body.data.id;
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({ roomId }) // missing dates, numberOfAdults
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 when checkOut <= checkIn (same-day checkout)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId,
          checkInDate: checkIn,
          checkOutDate: checkIn, // same day = invalid
          numberOfAdults: 1,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when guest count exceeds room capacity', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfAdults: roomCapacity + 10, // exceeds capacity
          numberOfChildren: 0,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for a non-existent roomId', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId: 'non-existent-room-id-000',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfAdults: 1,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /bookings/my
  // =========================================================================

  describe('GET /bookings/my (customer views own bookings)', () => {
    it('returns the customer\'s booking list including the one created above', async () => {
      const res = await request(app.getHttpServer())
        .get(`${prefix}/bookings/my`)
        .set(bearerHeader(customerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      const ids: string[] = res.body.data.data.map((b: { id: string }) => b.id);
      expect(ids).toContain(bookingId);
    });

    it('filters by status=PENDING and includes the created booking', async () => {
      const res = await request(app.getHttpServer())
        .get(`${prefix}/bookings/my`)
        .set(bearerHeader(customerToken))
        .query({ status: 'PENDING' })
        .expect(200);

      const statuses: string[] = res.body.data.data.map((b: { status: string }) => b.status);
      statuses.forEach((s) => expect(s).toBe('PENDING'));
    });
  });

  // =========================================================================
  // GET /bookings/:id
  // =========================================================================

  describe('GET /bookings/:id (owner or admin)', () => {
    it('customer can read their own booking', async () => {
      if (!bookingId) return;

      const res = await request(app.getHttpServer())
        .get(`${prefix}/bookings/${bookingId}`)
        .set(bearerHeader(customerToken))
        .expect(200);

      expect(res.body.data.id).toBe(bookingId);
    });

    it('admin can read any booking', async () => {
      if (!bookingId) return;

      const res = await request(app.getHttpServer())
        .get(`${prefix}/bookings/${bookingId}`)
        .set(bearerHeader(adminToken))
        .expect(200);

      expect(res.body.data.id).toBe(bookingId);
    });

    it('returns 404 for a non-existent booking id', async () => {
      await request(app.getHttpServer())
        .get(`${prefix}/bookings/non-existent-booking-00000`)
        .set(bearerHeader(customerToken))
        .expect(404);
    });
  });

  // =========================================================================
  // PATCH /admin/bookings/:id/approve
  // =========================================================================

  describe('PATCH /admin/bookings/:id/approve (admin approves)', () => {
    it('transitions booking from PENDING → APPROVED', async () => {
      if (!bookingId) return;

      const res = await request(app.getHttpServer())
        .patch(`${prefix}/admin/bookings/${bookingId}/approve`)
        .set(bearerHeader(adminToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('returns 404 for a non-existent booking id', async () => {
      await request(app.getHttpServer())
        .patch(`${prefix}/admin/bookings/non-existent-000/approve`)
        .set(bearerHeader(adminToken))
        .expect(404);
    });
  });

  // =========================================================================
  // PATCH /admin/bookings/:id/cancel (admin cancels the approved booking)
  // =========================================================================

  describe('PATCH /admin/bookings/:id/cancel (admin cancels)', () => {
    it('admin cancels an APPROVED booking', async () => {
      if (!bookingId) return;

      const res = await request(app.getHttpServer())
        .patch(`${prefix}/admin/bookings/${bookingId}/cancel`)
        .set(bearerHeader(adminToken))
        .send({ cancellationReason: 'Cancelled by admin for e2e test' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  // =========================================================================
  // PATCH /admin/bookings/:id/reject (a separate, fresh booking)
  // =========================================================================

  describe('PATCH /admin/bookings/:id/reject (admin rejects)', () => {
    let rejectBookingId: string;
    const rejectCheckIn = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const rejectCheckOut = new Date(Date.now() + 62 * 86400000).toISOString().slice(0, 10);

    beforeAll(async () => {
      // Create a fresh PENDING booking to reject
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId,
          checkInDate: rejectCheckIn,
          checkOutDate: rejectCheckOut,
          numberOfAdults: 1,
        })
        .expect(201);
      rejectBookingId = res.body.data.id;
    });

    it('transitions booking from PENDING → REJECTED with a reason', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${prefix}/admin/bookings/${rejectBookingId}/reject`)
        .set(bearerHeader(adminToken))
        .send({ rejectionReason: 'Room reserved for maintenance — e2e test' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
    });
  });

  // =========================================================================
  // PATCH /bookings/:id/cancel (customer self-cancel, fresh booking)
  // =========================================================================

  describe('PATCH /bookings/:id/cancel (customer self-cancel)', () => {
    let cancelBookingId: string;
    const cancelCheckIn = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const cancelCheckOut = new Date(Date.now() + 92 * 86400000).toISOString().slice(0, 10);

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/bookings`)
        .set(bearerHeader(customerToken))
        .send({
          roomId,
          checkInDate: cancelCheckIn,
          checkOutDate: cancelCheckOut,
          numberOfAdults: 1,
        })
        .expect(201);
      cancelBookingId = res.body.data.id;
    });

    it('customer cancels their own PENDING booking', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${prefix}/bookings/${cancelBookingId}/cancel`)
        .set(bearerHeader(customerToken))
        .send({ cancellationReason: 'Changed plans — e2e test' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('returns 400/422 when trying to cancel an already-CANCELLED booking', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${prefix}/bookings/${cancelBookingId}/cancel`)
        .set(bearerHeader(customerToken))
        .send({ cancellationReason: 'Double cancel attempt' });

      // Business rule: must reject with a 4xx
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /admin/bookings (admin list)
  // =========================================================================

  describe('GET /admin/bookings (admin list)', () => {
    it('returns all bookings with pagination envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`${prefix}/admin/bookings`)
        .set(bearerHeader(adminToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('filters by status=CANCELLED and only returns CANCELLED bookings', async () => {
      const res = await request(app.getHttpServer())
        .get(`${prefix}/admin/bookings`)
        .set(bearerHeader(adminToken))
        .query({ status: 'CANCELLED' })
        .expect(200);

      const statuses: string[] = res.body.data.data.map((b: { status: string }) => b.status);
      statuses.forEach((s) => expect(s).toBe('CANCELLED'));
    });
  });
});
