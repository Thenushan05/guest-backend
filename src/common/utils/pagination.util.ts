import { PaginatedResult, PaginationMeta } from '../dto/paginated-result';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Normalizes raw page/limit query values into safe, bounded pagination params.
 */
export function normalizePagination(page?: number, limit?: number): NormalizedPagination {
  const safePage = page && page > 0 ? Math.floor(page) : 1;
  const safeLimit = limit && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return {
    data,
    pagination: buildPaginationMeta(page, limit, total),
  };
}
