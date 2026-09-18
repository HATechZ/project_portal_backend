import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from './app-error-code';
import { mapPrismaException } from './prisma-exception.map';

describe('mapPrismaException', () => {
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
