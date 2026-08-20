import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from './configuration';
import { HttpExceptionFilter } from '../common/exceptions/http-exception.filter';
import { EtagInterceptor } from '../common/interceptors/etag.interceptor';
import { RequestIdInterceptor } from '../common/interceptors/request-id.interceptior';
import { OpenApiModule } from '../common/swagger/openapi.module';
import { SessionService } from '../infra/session/session.service';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService<AppConfiguration, true>);
  const prefix = config.get('app.apiPrefix', { infer: true });
  const origins = config.get('app.corsOrigins', { infer: true });
  const sessionService = app.get(SessionService);

  app.enableShutdownHooks();
  sessionService.configure(app);
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new EtagInterceptor());
  OpenApiModule.setup(app);
}
