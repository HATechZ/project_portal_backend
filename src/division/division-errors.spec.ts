import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { mapPrismaException } from '../common/exceptions/prisma-exception.map';

describe('Division persistence error mapping', () => {
  it('maps duplicate tenant/company abbreviation to 409 conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'division-test',
      meta: { target: 'divisions_tenant_id_company_id_abbr_key' },
    });

    expect(mapPrismaException(error)).toMatchObject({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message: 'A division with this abbreviation already exists',
    });
  });

  it('maps serialization races to 409 conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('race', {
      code: 'P2034',
      clientVersion: 'division-test',
    });

    expect(mapPrismaException(error)).toMatchObject({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
    });
  });
});
