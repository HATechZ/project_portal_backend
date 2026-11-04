import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from './app-error-code';
import { mapPrismaException } from './prisma-exception.map';

describe('mapPrismaException', () => {
  it('reports the obsolete team grant constraint as a service configuration issue', () => {
    const error = new Prisma.PrismaClientKnownRequestError('database constraint', {
      code: 'P2039', clientVersion: 'test', meta: { modelName: 'UserRole', driverAdapterError: { cause: {
        originalCode: '23514', originalMessage: 'Team-scoped custom role grants require team_id',
      } } },
    });
    expect(mapPrismaException(error)).toMatchObject({ code: AppErrorCode.ServiceUnavailable, status: HttpStatus.SERVICE_UNAVAILABLE, message: expect.stringContaining('database update') });
  });

  it('does not misclassify unrelated database check violations', () => {
    const error = new Prisma.PrismaClientKnownRequestError('database constraint', {
      code: 'P2039', clientVersion: 'test', meta: { modelName: 'UserRole', driverAdapterError: { cause: {
        originalCode: '23514', originalMessage: 'another check failed',
      } } },
    });
    expect(mapPrismaException(error)).toBeUndefined();
  });
  it('maps a prepared normalized OptionValue index conflict to a safe generic conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate key', {
      code: 'P2002',
      clientVersion: 'test',
      meta: {
        target: 'option_values_tenant_type_normalized_code_unique',
      },
    });

    const mapped = mapPrismaException(error);

    expect(mapped).toMatchObject({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
    });
    expect(mapped?.message).not.toContain(
      'option_values_tenant_type_normalized_code_unique',
    );
  });
});
