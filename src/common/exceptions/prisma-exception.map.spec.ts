import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from './app-error-code';
import { mapPrismaException } from './prisma-exception.map';

describe('mapPrismaException', () => {
  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
    ['P2034', 409],
  ])('maps %s centrally', (code, status) => {
    const error = new Prisma.PrismaClientKnownRequestError('database detail', {
      code: String(code),
      clientVersion: 'test',
    });
    expect(mapPrismaException(error)?.getStatus()).toBe(status);
    expect(mapPrismaException(error)?.message).not.toContain('database detail');
  });
  it('maps a provisioning unique violation to a privacy-safe conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '23505', message: 'users_email_key' },
    });

    const mapped = mapPrismaException(error);

    expect(mapped?.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(mapped?.code).toBe(AppErrorCode.Conflict);
    expect(mapped?.getResponse()).toEqual({
      code: AppErrorCode.Conflict,
      message: 'The Company Account conflicts with an existing account',
      details: undefined,
    });
    expect(JSON.stringify(mapped?.getResponse())).not.toMatch(
      /email_key|tenant/i,
    );
  });

  it('keeps invalid provisioning references as bad requests', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'invalid reference',
      {
        code: 'P2010',
        clientVersion: 'test',
        meta: { code: '23503' },
      },
    );

    expect(mapPrismaException(error)?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });
});
