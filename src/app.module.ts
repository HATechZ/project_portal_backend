import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { environmentSchema } from './config/env.schema';
import { OpenApiModule } from './common/swagger/openapi.module';
import { MailModule } from './infra/mail/mail.module';
import { MailWorkersModule } from './infra/mail/mail-workers.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { ThrottlerModule } from './infra/throttler/throttler.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: environmentSchema,
    }),
    CqrsModule.forRoot(),
    OpenApiModule.register(),
    PrismaModule,
    RedisModule,
    ThrottlerModule,
    MailModule,
    MailWorkersModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
