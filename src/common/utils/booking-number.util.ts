import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

/**
 * Generates a readable, unique booking number of the form GH-<YEAR>-<seq>,
 * e.g. GH-2026-000001.
 *
 * Must be called inside the same transaction that creates the booking so the
 * count-based sequence stays consistent. Uniqueness is still enforced at the
 * database level (Booking.bookingNumber is @unique); callers should retry on
 * a rare P2002 collision under high concurrency.
 */
export async function generateBookingNumber(tx: TxClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const countThisYear = await tx.booking.count({
    where: {
      createdAt: {
        gte: yearStart,
        lt: yearEnd,
      },
    },
  });

  const sequence = (countThisYear + 1).toString().padStart(6, '0');
  return `GH-${year}-${sequence}`;
}
