import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { RequestContext } from '../../common/context/request-context';
import { AppConfiguration } from '../../config/configuration';
import type { MailJobData } from '../../infra/mail/mail.worker';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';
import { AuthPasswordResetProvider } from './auth-password-reset.provider';

describe('AuthPasswordResetProvider delivery failures', () => {
  let storedHash: string | undefined;
  let queuedMail: MailJobData | undefined;
  const repository = {
    findActiveCredentials: jest.fn(),
    replacePasswordResetToken: jest.fn(),
    retireUndeliveredToken: jest.fn(),
    resetPassword: jest.fn(),
  };
  const queue = {
    add: jest.fn(),
  };
  const hashing = { hash: jest.fn(), compare: jest.fn() };
  const config = new ConfigService({
    jwt: {
      passwordResetTtlSeconds: 600,
      passwordResetUrl: 'https://example.invalid/reset',
    },
  });
  const provider = () =>
    new AuthPasswordResetProvider(
      config as unknown as ConfigService<AppConfiguration, true>,
      repository as unknown as PasswordRecoveryRepository,
      hashing,
      queue as unknown as Queue<MailJobData>,
    );
  const run = () =>
    RequestContext.run(
      { requestId: 'test', tenantId: '10000000-0000-4000-8000-000000000001' },
      () => provider().request('USER@example.invalid'),
    );
  beforeEach(() => {
    jest.resetAllMocks();
    storedHash = undefined;
    queuedMail = undefined;
    repository.replacePasswordResetToken.mockImplementation(
      (_id: string, tokenHash: string) => {
        storedHash = tokenHash;
        return Promise.resolve();
      },
    );
    queue.add.mockImplementation((_name: string, data: MailJobData) => {
      queuedMail = data;
      return Promise.resolve();
    });
    repository.findActiveCredentials.mockResolvedValue({
      id: 'user',
      email: 'user@example.invalid',
      fullName: 'Test',
    });
  });
  it('uses the same fulfilled result for unknown accounts and failed enqueue', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    queue.add.mockRejectedValue(new Error('queue down'));
    await expect(run()).resolves.toBeUndefined();
    expect(storedHash).toEqual(expect.any(String));
    expect(repository.retireUndeliveredToken).toHaveBeenCalledWith(storedHash);
    repository.findActiveCredentials.mockResolvedValue(null);
    await expect(run()).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalledTimes(1);
    logger.mockRestore();
  });
  it('hashes the exact delivered token and preserves the Tenant recovery link', async () => {
    await run();
    const url = new URL(String(queuedMail?.templateContext?.resetUrl));
    expect(url.searchParams.get('tenantId')).toBe(
      '10000000-0000-4000-8000-000000000001',
    );
    expect(repository.replacePasswordResetToken).toHaveBeenCalledWith(
      'user',
      createHash('sha256').update(url.searchParams.get('token')!).digest('hex'),
      expect.any(Date),
    );
    expect(repository.retireUndeliveredToken).not.toHaveBeenCalled();
  });
  it('rejects invalid tokens and accepts a successful atomic reset', async () => {
    hashing.hash.mockResolvedValue('new-hash');
    repository.resetPassword.mockResolvedValue(false);
    await expect(
      provider().reset('invalid', 'new-password'),
    ).rejects.toMatchObject({ status: 400 });
    repository.resetPassword.mockResolvedValue(true);
    await expect(
      provider().reset('valid', 'new-password'),
    ).resolves.toBeUndefined();
  });
});
