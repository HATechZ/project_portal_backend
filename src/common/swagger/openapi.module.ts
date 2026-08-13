import { DynamicModule, Module } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfiguration } from '../../config/configuration';
import { sharedSchemas } from './shared-schemas';

@Module({})
export class OpenApiModule {
  static register(): DynamicModule {
    return { module: OpenApiModule, global: true };
  }

  static setup(app: INestApplication): void {
    const config = app.get(ConfigService<AppConfiguration, true>);
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Project Portal API')
        .setDescription('Project Portal workflow management API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    document.components ??= {};
    document.components.schemas = {
      ...document.components.schemas,
      ...sharedSchemas,
    };
    SwaggerModule.setup(
      `${config.get('app.apiPrefix', { infer: true })}/docs`,
      app,
      document,
      {
        jsonDocumentUrl: `${config.get('app.apiPrefix', { infer: true })}/docs-json`,
      },
    );
  }
}
