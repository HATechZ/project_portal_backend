import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { mapPrismaException } from '../../common/exceptions/prisma-exception.map';
import { UserRepository } from '../repositories';
import { UserMutationProvider } from './user-mutation.provider';

describe('UserMutationProvider global email identity', () => {
  const repository = { create: jest.fn() };
  const hashingProvider = { hash: jest.fn(), compare: jest.fn() };
  const provider = () =>
    new UserMutationProvider(
      repository as unknown as UserRepository,
      hashingProvider,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    hashingProvider.hash.mockResolvedValue('password-hash');
  });

  it('normalizes email and surfaces a global cross-Tenant conflict as 409', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: 'users_email_key' },
    });
    repository.create.mockRejectedValue(duplicate);

    let thrown: unknown;
    try {
      await provider().create({
        fullName: 'Example User',
        email: ' Same.User@Example.com ',
        password: 'SecurePassword123',
      });
    } catch (error) {
      thrown = error;
    }

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'same.user@example.com' }),
    );
    expect(thrown).toBe(duplicate);
    const mapped = mapPrismaException(thrown);
    expect(mapped?.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(mapped?.message).toBe('A user with this email already exists');
  });
});
