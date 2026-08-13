import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from './app-error-code';
import { AppException } from './app-exception';

export function mapPrismaException(error: unknown): AppException | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new AppException({
        code: AppErrorCode.Conflict,
        message: 'A record with these unique values already exists',
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
