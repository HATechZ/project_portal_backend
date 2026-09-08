import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { AppConfiguration } from '../../config/configuration';
import { RequestContext } from '../../common/context/request-context';
import { MAIL_JOB_NAME, MAIL_QUEUE } from '../../infra/mail/mail.constants';
import type { MailJobData } from '../../infra/mail/mail.worker';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../infra/crypto/password-hasher.port';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';

const RESET_EMAIL_TEMPLATE = `
<h1>Reset your password</h1>
<p>Hello {{fullName}},</p>
<p>Use the link below to choose a new password. This link expires in {{expiresInMinutes}} minutes.</p>
<p><a href="{{resetUrl}}">Reset password</a></p>
<p>If you did not request this change, you can ignore this email.</p>
`;

@Injectable()
export class AuthPasswordResetProvider {
  private readonly logger = new Logger(AuthPasswordResetProvider.name);
  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly repository: PasswordRecoveryRepository,
    @Inject(PASSWORD_HASHER) private readonly hashingProvider: PasswordHasher,
    @Inject(MAIL_QUEUE) private readonly mailQueue: Queue<MailJobData>,
  ) {}

  async request(email: string): Promise<void> {
    try {
      await this.sendInstructions(email);
    } catch {
      // The public contract is identical for unknown accounts and delivery failures.
      this.logger.error('Password recovery request could not be completed');
    }
  }

  private async sendInstructions(email: string): Promise<void> {
    const user = await this.repository.findActiveCredentials(
      email.trim().toLowerCase(),
    );
    if (!user) return;

    const token = randomBytes(48).toString('base64url');
    const ttlSeconds = this.config.get('jwt.passwordResetTtlSeconds', {
      infer: true,
    });
    await this.repository.replacePasswordResetToken(
      user.id,
      this.hash(token),
      new Date(Date.now() + ttlSeconds * 1000),
    );

    const resetUrl = new URL(
      this.config.get('jwt.passwordResetUrl', { infer: true }),
    );
    resetUrl.searchParams.set('token', token);
    resetUrl.searchParams.set('tenantId', RequestContext.requireTenantId());
    try {
      await this.mailQueue.add(MAIL_JOB_NAME, {
        to: user.email,
        subject: 'Reset your Project Portal password',
        htmlTemplate: RESET_EMAIL_TEMPLATE,
        templateContext: {
          fullName: user.fullName,
          resetUrl: resetUrl.toString(),
          expiresInMinutes: Math.ceil(ttlSeconds / 60),
        },
        text: [
          `Hello ${user.fullName},`,
          '',
          `Reset your password: ${resetUrl.toString()}`,
          `This link expires in ${Math.ceil(ttlSeconds / 60)} minutes.`,
          '',
          'If you did not request this change, you can ignore this email.',
        ].join('\n'),
      });
    } catch {
      await this.repository.retireUndeliveredToken(this.hash(token));
      throw new Error('Password recovery enqueue failed');
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashingProvider.hash(newPassword);
    const reset = await this.repository.resetPassword(
      this.hash(token),
      passwordHash,
    );
    if (!reset) {
      throw new BadRequestException('Invalid or expired password reset token');
    }
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
