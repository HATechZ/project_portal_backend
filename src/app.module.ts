import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './infra/session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: environmentSchema,
    }),
    OpenApiModule.register(),
    PrismaModule,
    RedisModule,
    SessionModule,
    ThrottlerModule,
    MailModule,
    MailWorkersModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
