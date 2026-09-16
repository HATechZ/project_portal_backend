import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AppConfiguration } from './configuration';
import { HttpExceptionFilter } from '../common/exceptions/http-exception.filter';
import { EtagInterceptor } from '../common/interceptors/etag.interceptor';
import { RequestIdInterceptor } from '../common/interceptors/request-id.interceptior';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { OpenApiModule } from '../common/swagger/openapi.module';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import type { ValidationError } from 'class-validator';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService<AppConfiguration, true>);
  const prefix = config.get('app.apiPrefix', { infer: true });
  const origins = config.get('app.corsOrigins', { infer: true });

  app.enableShutdownHooks();
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
      exceptionFactory: (errors: ValidationError[]) =>
        new AppException({
          code: AppErrorCode.ValidationFailed,
          message:
            'Some information is invalid. Correct the highlighted fields and try again.',
          details: validationDetails(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new EtagInterceptor(),
    new TransformInterceptor(app.get(Reflector)),
  );
  OpenApiModule.setup(app);
}

function validationDetails(errors: ValidationError[], parent = ''): unknown[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.entries(error.constraints ?? {}).map(
      ([constraint, message]) => ({
        field,
        message: validationMessage(constraint, message),
      }),
    );
    return [...messages, ...validationDetails(error.children ?? [], field)];
  });
}

function validationMessage(constraint: string, fallback: string): string {
  if (constraint === 'isDefined' || constraint === 'isNotEmpty')
    return 'This field is required.';
  if (constraint === 'isEmail') return 'Enter a valid email address.';
  if (constraint.startsWith('isUuid') || constraint === 'isUUID')
    return 'The selected value is invalid.';
  return fallback;
}
