import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infra/prisma/prisma.service';
import { MAIL_QUEUE } from './../src/infra/mail/mail.constants';
import { MailQueueService } from './../src/infra/mail/mail-queue.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: jest.fn().mockResolvedValue({
          totalHits: 1,
          timeToExpire: 60_000,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(MAIL_QUEUE)
      .useValue({ add: jest.fn(), close: jest.fn() })
      .overrideProvider(MailQueueService)
      .useValue({ add: jest.fn(), close: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
