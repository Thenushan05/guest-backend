/**
 * E2E Auth Helper
 *
 * Provides convenience functions for obtaining JWT tokens and pre-built
 * Authorization headers for each role. Shared across all e2e suites.
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from './app.helper';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Login and return both tokens. Throws if login fails. */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<Tokens> {
  const res = await request(app.getHttpServer())
    .post(`/${API_PREFIX}/auth/login`)
    .send({ email, password })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/** Returns a Bearer authorization header object for use in supertest .set(). */
export function bearerHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Credentials from the seed script / .env.test */
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@guesthouse.com';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
export const CUSTOMER_EMAIL = 'customer@example.com';
export const CUSTOMER_PASSWORD = 'Customer@12345';
