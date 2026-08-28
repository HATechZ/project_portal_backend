import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from './app-error-code';
import { AppException } from './app-exception';

/**
 * Specific 409 messages, keyed by the Postgres constraint that was violated.
 *
 * This map is why providers do not need their own `P2002` catch (Art. VI.4).
 * The alternative — every provider translating its own unique violation — put
 * the same `instanceof PrismaClientKnownRequestError` check in three modules
 * and made Prisma an ambient dependency of the domain layer.
 *
 * Keys are the literal index names in `prisma/migrations/`, which is what
 * Postgres reports. A constraint that is missing here falls back to the generic
 * message below: the worst case is a vaguer 409, never a wrong one.
 */
const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  users_email_key: 'A user with this email already exists',
  users_tenant_id_email_key: 'A user with this email already exists',
  companies_abbr_key: 'A company with this abbreviation already exists',
  companies_tenant_id_abbr_key:
    'A company with this abbreviation already exists',
  user_roles_active_tenant_user_role_key: 'The user already has this role',
  processed_events_tenant_id_event_id_consumer_key:
    'This event has already been processed by this consumer',
};

/**
 * `meta.target` is either the constraint name or the field list, depending on
 * the driver. Try every reading rather than assuming one.
 */
function uniqueConstraintMessage(meta: unknown): string | undefined {
  const target = (meta as { target?: unknown } | undefined)?.target;
  const candidates =
    typeof target === 'string'
      ? [target]
      : Array.isArray(target)
        ? [target.join('_'), ...target.map((part) => String(part))]
        : [];
  for (const candidate of candidates) {
    const message = UNIQUE_CONSTRAINT_MESSAGES[candidate];
    if (message) return message;
  }
  return undefined;
}

export function mapPrismaException(error: unknown): AppException | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new AppException({
        code: AppErrorCode.Conflict,
        message:
          uniqueConstraintMessage(error.meta) ??
          'A record with these unique values already exists',
        status: HttpStatus.CONFLICT,
        details: error.meta,
        cause: error,
      });
    }
    if (error.code === 'P2003') {
      return new AppException({
        code: AppErrorCode.DatabaseConstraint,
        message: 'The operation violates a related record constraint',
        status: HttpStatus.CONFLICT,
        details: error.meta,
        cause: error,
      });
    }
    if (error.code === 'P2025') {
      return new AppException({
        code: AppErrorCode.NotFound,
        message: 'The requested record was not found',
        status: HttpStatus.NOT_FOUND,
        cause: error,
      });
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppException({
      code: AppErrorCode.ServiceUnavailable,
      message: 'Database service is unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      cause: error,
    });
  }
  return undefined;
}
