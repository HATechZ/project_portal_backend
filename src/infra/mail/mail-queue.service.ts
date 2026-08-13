import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AppConfiguration } from '../../config/configuration';

@Injectable()
export class MailQueueService extends Queue implements OnApplicationShutdown {
  constructor(config: ConfigService<AppConfiguration, true>) {
    const mail = config.getOrThrow('mail', { infer: true });
    const redis = config.getOrThrow('redis', { infer: true });
    super(mail.queueName, {
      connection: { url: redis.url, maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
