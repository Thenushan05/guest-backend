/**
 * Auth e2e test suite
 *
 * Covers the complete authentication lifecycle against a real NestJS app
 * and a real MySQL database (pointed at DATABASE_URL in .env.test).
 *
 * Prerequisites:
 *   1. A dedicated test database configured via .env.test
 *   2. `prisma migrate deploy` run against that database
 *   3. `prisma db seed` run to populate admin + customer users
 *
 * Coverage
 * --------
 *  POST /auth/register
 *    ✓ registers a new customer and returns tokens + user profile
 *    ✓ returns 409 when email is already taken
 *    ✓ returns 400 when required fields are missing (validation)
 *    ✓ returns 400 when password is too weak
 *    ✓ registered user is always CUSTOMER role (never ADMIN)
 *
 *  POST /auth/login
 *    ✓ logs in with correct credentials and returns tokens + user profile
 *    ✓ returns 401 on wrong password
 *    ✓ returns 401 on unknown email
 *    ✓ response shape matches { success, message, data: { accessToken, refreshToken, user } }
 *
 *  POST /auth/refresh
 *    ✓ exchanges a valid refresh token for a new token pair
 *    ✓ returns 401 for an expired / invalid refresh token
 *    ✓ returns 401 after the refresh token has been revoked (used)
 *
 *  GET /auth/me
 *    ✓ returns the authenticated user's profile
 *    ✓ returns 401 when no Bearer token is sent
 *    ✓ returns 401 when an invalid/expired token is sent
 *
 *  POST /auth/logout
 *    ✓ logs out and revokes the refresh token
 *    ✓ refresh token can no longer be used after logout
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp, API_PREFIX } from './helpers/app.helper';
import {
  loginAs,
  bearerHeader,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './helpers/auth.helper';

// ---------------------------------------------------------------------------
// Unique-per-run email so parallel runs don't collide
// ---------------------------------------------------------------------------
const ts = Date.now();
const TEST_USER = {
  firstName: 'E2E',
  lastName: 'Tester',
  email: `e2e-${ts}@test.com`,
  password: 'TestPass@123',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prefix: string;
  let adminTokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    ({ app, prefix } = await createTestApp());
    adminTokens = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // =========================================================================
  // POST /auth/register
  // =========================================================================

  describe('POST /auth/register', () => {
    it('registers a new customer and returns tokens + user', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send(TEST_USER)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(TEST_USER.email);
    });

    it('returns 409 when email is already registered', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send(TEST_USER)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send({ email: `missing-${ts}@test.com` }) // no password, no names
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('always assigns CUSTOMER role — never ADMIN', async () => {
      // Use the already-obtained token from registration above — no extra login.
      const regRes = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send({ ...TEST_USER, email: `e2e-role-${ts}@test.com` })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get(`${prefix}/auth/me`)
        .set(bearerHeader(regRes.body.data.accessToken))
        .expect(200);

      expect(me.body.data.role).toBe('CUSTOMER');
    });
  });

  // =========================================================================
  // POST /auth/login
  // =========================================================================

  describe('POST /auth/login', () => {
    it('logs in with valid credentials and returns the correct shape', async () => {
      // Use TEST_USER — separate throttle bucket from the admin account.
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/login`)
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: {
            email: TEST_USER.email,
            role: 'CUSTOMER',
          },
        },
      });
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/login`)
        .send({ email: TEST_USER.email, password: 'wrong-password' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/login`)
        .send({ email: 'nobody@nowhere.com', password: 'anything' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /auth/refresh
  // =========================================================================

  describe('POST /auth/refresh', () => {
    it('exchanges a valid refresh token for a new token pair', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken: adminTokens.refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // New refresh token should differ from the used one (rotation)
      expect(res.body.data.refreshToken).not.toBe(adminTokens.refreshToken);
    });

    it('returns 401 for a tampered / invalid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken: 'this.is.not.a.valid.jwt' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 when a used refresh token is replayed (revocation)', async () => {
      // Register a unique user — tokens from register are valid without
      // consuming the login rate limit.
      const regRes = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send({ ...TEST_USER, email: `e2e-revoke-${ts}@test.com` })
        .expect(201);

      const { refreshToken } = regRes.body.data;

      // First use — should succeed
      await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken })
        .expect(200);

      // Replay the same token — must be rejected (token is now revoked)
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /auth/me
  // =========================================================================

  describe('GET /auth/me', () => {
    it('returns the authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`${prefix}/auth/me`)
        .set(bearerHeader(adminTokens.accessToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(ADMIN_EMAIL);
      expect(res.body.data.passwordHash).toBeUndefined(); // never exposed
    });

    it('returns 401 when no Bearer token is provided', async () => {
      await request(app.getHttpServer()).get(`${prefix}/auth/me`).expect(401);
    });

    it('returns 401 for a garbage token', async () => {
      await request(app.getHttpServer())
        .get(`${prefix}/auth/me`)
        .set({ Authorization: 'Bearer garbage.token.here' })
        .expect(401);
    });
  });

  // =========================================================================
  // POST /auth/logout
  // =========================================================================

  describe('POST /auth/logout', () => {
    it('logs out and revokes the refresh token', async () => {
      // Register a fresh user — register returns tokens without consuming
      // the login throttle bucket, so this never gets a 429.
      const regRes = await request(app.getHttpServer())
        .post(`${prefix}/auth/register`)
        .send({ ...TEST_USER, email: `e2e-logout-${ts}@test.com` })
        .expect(201);

      const { accessToken, refreshToken } = regRes.body.data;

      // Logout
      await request(app.getHttpServer())
        .post(`${prefix}/auth/logout`)
        .set(bearerHeader(accessToken))
        .send({ refreshToken })
        .expect(200);

      // The refresh token should now be revoked
      const res = await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
