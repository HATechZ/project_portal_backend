import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './config/app-bootstrap';
import { AppConfiguration } from './config/configuration';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApplication(app);
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  const configService = app.get(ConfigService<AppConfiguration, true>);
  const port = configService.get('app.port', { infer: true });
  const apiPrefix = configService.get('app.apiPrefix', { infer: true });

  await app.listen(port, '0.0.0.0');

  const applicationUrl = `http://localhost:${port}`;
  Logger.log(`API running: ${applicationUrl}/${apiPrefix}/v1`, 'Bootstrap');
  Logger.log(`Swagger UI: ${applicationUrl}/${apiPrefix}/docs`, 'Bootstrap');
}

void bootstrap();
