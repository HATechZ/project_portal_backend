import { PaginatedResult } from './paginated-result';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationArgs {
  skip: number;
  take: number;
}

export function paginationArgs(input: PaginationInput): PaginationArgs {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  return { skip: (page - 1) * limit, take: limit };
}

export async function paginate<T>(
  input: PaginationInput,
  fetch: (args: PaginationArgs) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const [items, total] = await Promise.all([
    fetch(paginationArgs({ page, limit })),
    count(),
  ]);
  return new PaginatedResult(items, total, page, limit);
}
