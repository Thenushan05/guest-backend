/**
 * Date utility functions – unit tests
 *
 * These are pure-function tests with no dependencies.
 *
 * Coverage
 * --------
 * toUtcDateOnly()
 *   ✓ parses YYYY-MM-DD strings to UTC midnight
 *   ✓ strips time component from full ISO timestamps
 *   ✓ accepts Date objects and normalizes them
 *   ✓ does not shift the date due to local timezone
 *
 * todayUtcDateOnly()
 *   ✓ returns today's UTC date at midnight
 *
 * calculateNights()
 *   ✓ calculates correct number of nights for N-day ranges
 *   ✓ returns 1 for adjacent dates (1 night)
 *   ✓ returns 0 for the same date (zero nights)
 *
 * dateRangesOverlap()
 *   ✓ overlapping ranges return true
 *   ✓ adjacent ranges (back-to-back) return false (checkout == next checkin)
 *   ✓ non-overlapping ranges return false
 *   ✓ one range fully inside another returns true
 *   ✓ equal ranges return true
 *
 * formatDateOnly()
 *   ✓ formats UTC midnight dates as YYYY-MM-DD strings
 *
 * assertValidDateRange()
 *   ✓ passes for valid future date range
 *   ✓ throws when checkOut === checkIn (zero nights)
 *   ✓ throws when checkOut < checkIn (inverted range)
 *   ✓ throws when checkIn is in the past
 *   ✓ passes when checkIn is today (not in the past)
 */

import {
  assertValidDateRange,
  calculateNights,
  dateRangesOverlap,
  formatDateOnly,
  toUtcDateOnly,
  todayUtcDateOnly,
} from '../date.util';
import { InvalidBookingDatesException } from '../../exceptions/domain-exceptions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('date.util', () => {
  // =========================================================================
  // toUtcDateOnly
  // =========================================================================

  describe('toUtcDateOnly()', () => {
    it('should parse a YYYY-MM-DD string to UTC midnight', () => {
      const result = toUtcDateOnly('2026-09-10');
      expect(result.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    });

    it('should strip the time component from a full ISO timestamp', () => {
      const result = toUtcDateOnly('2026-09-10T15:30:00.000Z');
      expect(result.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    });

    it('should accept a Date object and return UTC midnight for that day', () => {
      const input = new Date('2026-09-10T12:00:00.000Z');
      const result = toUtcDateOnly(input);
      expect(result.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    });

    it('should not shift the date regardless of local timezone offset', () => {
      // This test validates that the function is timezone-safe.
      const result = toUtcDateOnly('2026-01-01');
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(1);
    });
  });

  // =========================================================================
  // todayUtcDateOnly
  // =========================================================================

  describe('todayUtcDateOnly()', () => {
    it('should return a Date at UTC midnight matching today', () => {
      const now = new Date();
      const result = todayUtcDateOnly();

      expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(result.getUTCMonth()).toBe(now.getUTCMonth());
      expect(result.getUTCDate()).toBe(now.getUTCDate());
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });

  // =========================================================================
  // calculateNights
  // =========================================================================

  describe('calculateNights()', () => {
    it('should return 1 for adjacent dates (one night)', () => {
      expect(calculateNights(utcDate(2026, 9, 10), utcDate(2026, 9, 11))).toBe(1);
    });

    it('should return 5 for a 5-night stay', () => {
      expect(calculateNights(utcDate(2026, 9, 10), utcDate(2026, 9, 15))).toBe(5);
    });

    it('should return 0 for the same date (no nights)', () => {
      expect(calculateNights(utcDate(2026, 9, 10), utcDate(2026, 9, 10))).toBe(0);
    });

    it('should handle month-crossing ranges correctly', () => {
      // Sep 29 → Oct 3 = 4 nights
      expect(calculateNights(utcDate(2026, 9, 29), utcDate(2026, 10, 3))).toBe(4);
    });

    it('should handle year-crossing ranges correctly', () => {
      // Dec 30 → Jan 2 = 3 nights
      expect(calculateNights(utcDate(2026, 12, 30), utcDate(2027, 1, 2))).toBe(3);
    });
  });

  // =========================================================================
  // dateRangesOverlap
  // =========================================================================

  describe('dateRangesOverlap()', () => {
    it('should return true when ranges fully overlap', () => {
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 12),
          utcDate(2026, 9, 18),
        ),
      ).toBe(true);
    });

    it('should return true when one range is fully inside the other', () => {
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 8),
          utcDate(2026, 9, 20),
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
        ),
      ).toBe(true);
    });

    it('should return true when ranges are identical', () => {
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
        ),
      ).toBe(true);
    });

    it('should return false when ranges are adjacent (checkout == next checkin)', () => {
      // Guest A checks out Sep 15 → Guest B checks in Sep 15 (same day) → no overlap
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 20),
        ),
      ).toBe(false);
    });

    it('should return false when requested dates are entirely after existing booking', () => {
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 16),
          utcDate(2026, 9, 20),
        ),
      ).toBe(false);
    });

    it('should return false when requested dates are entirely before existing booking', () => {
      expect(
        dateRangesOverlap(
          utcDate(2026, 9, 10),
          utcDate(2026, 9, 15),
          utcDate(2026, 9, 1),
          utcDate(2026, 9, 9),
        ),
      ).toBe(false);
    });
  });

  // =========================================================================
  // formatDateOnly
  // =========================================================================

  describe('formatDateOnly()', () => {
    it('should format a UTC midnight Date as YYYY-MM-DD', () => {
      expect(formatDateOnly(utcDate(2026, 9, 5))).toBe('2026-09-05');
    });

    it('should zero-pad month and day correctly', () => {
      expect(formatDateOnly(utcDate(2026, 1, 1))).toBe('2026-01-01');
    });
  });

  // =========================================================================
  // assertValidDateRange
  // =========================================================================

  describe('assertValidDateRange()', () => {
    const today = todayUtcDateOnly();
    const tomorrow = utcDate(
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      today.getUTCDate() + 1,
    );
    const dayAfter = utcDate(
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      today.getUTCDate() + 2,
    );

    it('should not throw for a valid future date range', () => {
      expect(() => assertValidDateRange(tomorrow, dayAfter)).not.toThrow();
    });

    it('should not throw when checkIn is today (today is not in the past)', () => {
      expect(() => assertValidDateRange(today, tomorrow)).not.toThrow();
    });

    it('should throw InvalidBookingDatesException when checkOut equals checkIn', () => {
      expect(() => assertValidDateRange(tomorrow, tomorrow)).toThrow(InvalidBookingDatesException);
    });

    it('should throw InvalidBookingDatesException when checkOut is before checkIn', () => {
      expect(() => assertValidDateRange(dayAfter, tomorrow)).toThrow(InvalidBookingDatesException);
    });

    it('should throw InvalidBookingDatesException when checkIn is in the past', () => {
      const yesterday = utcDate(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        today.getUTCDate() - 1,
      );
      expect(() => assertValidDateRange(yesterday, today)).toThrow(InvalidBookingDatesException);
    });

    it('should include a descriptive message when checkout is not after checkin', () => {
      expect(() => assertValidDateRange(tomorrow, today)).toThrow(
        'Check-out date must be after check-in date',
      );
    });

    it('should include a descriptive message when checkin is in the past', () => {
      const longAgo = utcDate(2020, 1, 1);
      expect(() => assertValidDateRange(longAgo, tomorrow)).toThrow(
        'Check-in date cannot be in the past',
      );
    });
  });
});
