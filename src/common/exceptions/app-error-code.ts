export enum AppErrorCode {
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  ValidationFailed = 'VALIDATION_FAILED',
  RateLimitExceeded = 'RATE_LIMIT_EXCEEDED',
  DatabaseConstraint = 'DATABASE_CONSTRAINT',
  InternalError = 'INTERNAL_ERROR',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
}
