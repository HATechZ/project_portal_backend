import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import SMTPPool from 'nodemailer/lib/smtp-pool';
import { AppConfiguration } from '../../config/configuration';
import { MailMessage, MailSender } from './mail-sender.port';

@Injectable()
export class NodemailerMailSender implements MailSender {
  private readonly transporter: Transporter<SMTPPool.SentMessageInfo>;
  private readonly from: string;

  constructor(config: ConfigService<AppConfiguration, true>) {
    const mail = config.getOrThrow<AppConfiguration['mail']>('mail');
    this.from = mail.from;
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth:
        mail.user && mail.password
          ? { user: mail.user, pass: mail.password }
          : undefined,
      pool: true,
    });
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const result = await this.transporter.sendMail({
      from: this.from,
      ...message,
    });
    return { messageId: result.messageId };
  }
}
