import { DynamicModule, Module } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppConfiguration } from '../../config/configuration';
import { sharedSchemas } from './shared-schemas';
import { SESSION_COOKIE_NAME } from '../../infra/session/session.constants';

function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

export function generateDocsHtml(jsonPath: string): string {
  const configuration = {
    url: jsonPath,
    withDefaultFonts: true,
    showSidebar: true,
    persistAuth: true,
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Project Portal API Documentation</title>
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <div id="api-reference"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      var configuration = ${serializeForScript(configuration)};
      configuration.customFetch = function (input, init) {
        return window.fetch(input, Object.assign({}, init, {
          credentials: 'include'
        }));
      };
      Scalar.createApiReference('#api-reference', configuration);
    </script>
  </body>
</html>`;
}

@Module({})
export class OpenApiModule {
  static register(): DynamicModule {
    return { module: OpenApiModule, global: true };
  }

  static setup(app: INestApplication): void {
    const config = app.get(ConfigService<AppConfiguration, true>);
    const apiPrefix = config.get('app.apiPrefix', { infer: true });
    const docsPath = `/${apiPrefix}/docs`;
    const jsonPath = `/${apiPrefix}/docs-json`;
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Project Portal API')
        .setDescription('Project Portal workflow management API')
        .setVersion('1.0')
        .addCookieAuth(
          SESSION_COOKIE_NAME,
          { type: 'apiKey', in: 'cookie' },
          'session',
        )
        .addApiKey(
          { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
          'tenant',
        )
        .build(),
    );
    document.components ??= {};
    document.components.schemas = {
      ...document.components.schemas,
      ...sharedSchemas,
    };

    this.setupScalarRoutes(app, docsPath, jsonPath, document);
  }

  private static setupScalarRoutes(
    app: INestApplication,
    docsPath: string,
    jsonPath: string,
    document: OpenAPIObject,
  ): void {
    const httpAdapter = app.getHttpAdapter();
    const docsHtml = generateDocsHtml(jsonPath);

    httpAdapter.get(docsPath, (_request: unknown, response: unknown) => {
      (response as { type: (value: string) => void }).type('text/html');
      (response as { send: (body: string) => void }).send(docsHtml);
    });

    httpAdapter.get(jsonPath, (_request: unknown, response: unknown) => {
      (response as { json: (body: OpenAPIObject) => void }).json(document);
    });
  }
}
