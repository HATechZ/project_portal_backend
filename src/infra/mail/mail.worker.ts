import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { AppConfiguration } from '../../config/configuration';
import { MAIL_JOB_NAME } from './mail.constants';
import { MAIL_SENDER } from './mail-sender.port';
import type { MailMessage, MailSender } from './mail-sender.port';
import { TEMPLATE_RENDERER } from './template-renderer.port';
import type { TemplateRenderer } from './template-renderer.port';

export interface MailJobData extends Omit<MailMessage, 'html'> {
  htmlTemplate?: string;
  templateContext?: Record<string, unknown>;
  html?: string;
}

@Injectable()
export class MailWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MailWorker.name);
  private worker?: Worker<MailJobData>;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    @Inject(MAIL_SENDER) private readonly sender: MailSender,
    @Inject(TEMPLATE_RENDERER) private readonly renderer: TemplateRenderer,
  ) {}

  onModuleInit(): void {
    const mail = this.config.getOrThrow('mail', { infer: true });
    const redis = this.config.getOrThrow('redis', { infer: true });
    if (!mail.workerEnabled) return;
    this.worker = new Worker<MailJobData>(
      mail.queueName,
      (job) => this.process(job),
      {
        connection: {
          url: redis.url,
          maxRetriesPerRequest: null,
        },
        concurrency: 5,
      },
    );
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Mail job ${job?.id ?? 'unknown'} failed`, error.stack),
    );
  }

  private async process(job: Job<MailJobData>): Promise<{ messageId: string }> {
    if (job.name !== MAIL_JOB_NAME)
      throw new Error(`Unsupported mail job: ${job.name}`);
    const { htmlTemplate, templateContext = {}, ...message } = job.data;
    const html = htmlTemplate
      ? await this.renderer.render(htmlTemplate, templateContext)
      : message.html;
    return this.sender.send({ ...message, html });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
