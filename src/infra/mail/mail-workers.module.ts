import { Module } from '@nestjs/common';
import { MailModule } from './mail.module';
import { MailWorker } from './mail.worker';

@Module({ imports: [MailModule], providers: [MailWorker] })
export class MailWorkersModule {}
