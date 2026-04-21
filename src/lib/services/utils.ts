import { and, count, desc, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PaginationInput, PaginatedResult } from "./types";

export function getPagination(input: PaginationInput = {}) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 8, 1), 100);
  const page = Math.max(input.page ?? 1, 1);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  pagination: { page: number; pageSize: number }
): PaginatedResult<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}

export function searchTerm(term: string | null | undefined) {
  const value = term?.trim();
  return value ? `%${value}%` : null;
}

export function toNullableArray<T>(values: T[]) {
  return values.length > 0 ? values : null;
}

export { and, count, desc, ilike, or, sql };
export type { SQL };
