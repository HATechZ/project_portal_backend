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
const UNIQUE_CONSTRAINT_MESSAGES: Record<
  string,
  { code: AppErrorCode; message: string }
> = {
  users_email_key: {
    code: AppErrorCode.DuplicateUserEmail,
    message:
      'A user with this email already exists. Use a different email or use the existing account.',
  },
  users_tenant_id_email_key: {
    code: AppErrorCode.DuplicateUserEmail,
    message:
      'A user with this email already exists. Use a different email or use the existing account.',
  },
  companies_abbr_key: {
    code: AppErrorCode.DuplicateCompanyAbbreviation,
    message:
      'A company with this abbreviation already exists. Use a different abbreviation.',
  },
  companies_tenant_id_abbr_key: {
    code: AppErrorCode.DuplicateCompanyAbbreviation,
    message:
      'A company with this abbreviation already exists. Use a different abbreviation.',
  },
  divisions_tenant_id_company_id_abbr_key: {
    code: AppErrorCode.DuplicateDivisionAbbreviation,
    message:
      'A division with this abbreviation already exists. Use a different abbreviation.',
  },
  user_roles_active_tenant_user_role_key: {
    code: AppErrorCode.UserRoleAlreadyAssigned,
    message: 'This user already has the selected role.',
  },
};

/**
 * `meta.target` is either the constraint name or the field list, depending on
 * the driver. Try every reading rather than assuming one.
 */
function uniqueConstraintMessage(
  meta: unknown,
): { code: AppErrorCode; message: string } | undefined {
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

const INVALID_SIGNUP_SQLSTATES = new Set(['22001', '22023', '23503']);
const UNIQUE_VIOLATION_SQLSTATE = '23505';

function rawQuerySqlState(error: Prisma.PrismaClientKnownRequestError): string {
  const meta = error.meta as
    | {
        code?: unknown;
        driverAdapterError?: { cause?: { originalCode?: unknown } };
      }
    | undefined;

  const value = meta?.code ?? meta?.driverAdapterError?.cause?.originalCode;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

export function mapPrismaException(error: unknown): AppException | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return new AppException({
        code: AppErrorCode.StaleUpdate,
        message:
          'This record was changed by another user. Refresh the page and try again.',
        status: HttpStatus.CONFLICT,
        cause: error,
      });
    }
    if (error.code === 'P2002') {
      return new AppException({
        code:
          uniqueConstraintMessage(error.meta)?.code ?? AppErrorCode.Conflict,
        message:
          uniqueConstraintMessage(error.meta)?.message ??
          'This change cannot be completed because it conflicts with an existing record. Review the information and try again.',
        status: HttpStatus.CONFLICT,
        cause: error,
      });
    }
    if (error.code === 'P2003') {
      return new AppException({
        code: AppErrorCode.DatabaseConstraint,
        message:
          'This change cannot be completed because related records still depend on this item. Review those relationships and try again.',
        status: HttpStatus.CONFLICT,
        cause: error,
      });
    }
    if (error.code === 'P2025') {
      return new AppException({
        code: AppErrorCode.NotFound,
        message:
          'The requested resource was not found. Refresh the page and try again.',
        status: HttpStatus.NOT_FOUND,
        cause: error,
      });
    }
    if (
      error.code === 'P2010' &&
      INVALID_SIGNUP_SQLSTATES.has(rawQuerySqlState(error))
    ) {
      return new AppException({
        code: AppErrorCode.BadRequest,
        message:
          'Some information is invalid. Correct the highlighted fields and try again.',
        status: HttpStatus.BAD_REQUEST,
        cause: error,
      });
    }
    if (
      error.code === 'P2010' &&
      rawQuerySqlState(error) === UNIQUE_VIOLATION_SQLSTATE
    ) {
      return new AppException({
        code: AppErrorCode.Conflict,
        message:
          'This change cannot be completed because it conflicts with an existing account. Review the information and try again.',
        status: HttpStatus.CONFLICT,
        cause: error,
      });
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppException({
      code: AppErrorCode.ServiceUnavailable,
      message:
        'The service is temporarily unavailable. Please try again shortly.',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      cause: error,
    });
  }
  return undefined;
}
