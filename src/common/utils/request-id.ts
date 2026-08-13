import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export function normalizeRequestId(value: unknown): string {
  if (typeof value !== 'string') return randomUUID();
  const requestId = value.trim();
  return requestId.length > 0 && requestId.length <= 128
    ? requestId
    : randomUUID();
}
