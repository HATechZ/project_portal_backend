import { Module } from '@nestjs/common';
import { HandlebarsTemplateRenderer } from './handlebars-template-renderer';
import { MAIL_QUEUE } from './mail.constants';
import { MailQueueService } from './mail-queue.service';
import { MAIL_SENDER } from './mail-sender.port';
import { NodemailerMailSender } from './nodemailer-mail-sender';
import { TEMPLATE_RENDERER } from './template-renderer.port';

@Module({
  providers: [
    HandlebarsTemplateRenderer,
    NodemailerMailSender,
    MailQueueService,
    { provide: TEMPLATE_RENDERER, useExisting: HandlebarsTemplateRenderer },
    { provide: MAIL_SENDER, useExisting: NodemailerMailSender },
    { provide: MAIL_QUEUE, useExisting: MailQueueService },
  ],
  exports: [
    MAIL_QUEUE,
    MAIL_SENDER,
    TEMPLATE_RENDERER,
    NodemailerMailSender,
    HandlebarsTemplateRenderer,
  ],
})
export class MailModule {}
