/**
 * Date utilities for booking logic.
 *
 * Booking dates are calendar dates (check-in / check-out), not timestamps.
 * To avoid timezone bugs (a date shifting by one day depending on server or
 * client timezone), every date is normalized to a UTC midnight `Date` before
 * being compared, stored, or persisted via Prisma's `@db.Date` columns.
 */
import { InvalidBookingDatesException } from '../exceptions/domain-exceptions';

/**
 * Parses an ISO date string ("YYYY-MM-DD" or full ISO timestamp) and returns
 * a Date object pinned to UTC midnight for that calendar day.
 */
export function toUtcDateOnly(input: string | Date): Date {
  const source = typeof input === 'string' ? input : input.toISOString();
  const datePart = source.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Returns today's calendar date normalized to UTC midnight. */
export function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Number of whole nights between two UTC-midnight-normalized dates. */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerNight = 24 * 60 * 60 * 1000;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / msPerNight);
}

export function isBeforeDate(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isSameOrAfterDate(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}

/**
 * Overlap rule used everywhere availability is decided:
 * existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
 */
export function dateRangesOverlap(
  existingCheckIn: Date,
  existingCheckOut: Date,
  requestedCheckIn: Date,
  requestedCheckOut: Date,
): boolean {
  return (
    existingCheckIn.getTime() < requestedCheckOut.getTime() &&
    existingCheckOut.getTime() > requestedCheckIn.getTime()
  );
}

/** Formats a Date as "YYYY-MM-DD" (UTC), safe for API responses. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Validates the fundamental booking date invariants shared by booking
 * creation and availability search:
 *  - checkOutDate must be strictly after checkInDate
 *  - checkInDate cannot be in the past
 * Throws InvalidBookingDatesException (imported lazily to avoid a cycle)
 * when a rule is violated.
 */
export function assertValidDateRange(checkIn: Date, checkOut: Date): void {
  if (!isBeforeDate(checkIn, checkOut)) {
    throw new InvalidBookingDatesException('Check-out date must be after check-in date');
  }

  if (isBeforeDate(checkIn, todayUtcDateOnly())) {
    throw new InvalidBookingDatesException('Check-in date cannot be in the past');
  }
}
