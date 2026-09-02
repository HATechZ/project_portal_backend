import { buildOpenApiConfig, generateDocsHtml } from './openapi.module';

describe('OpenAPI authentication contract', () => {
  it('defines bearer authentication so the UI adds the prefix', () => {
    const config = buildOpenApiConfig();
    const bearer = config.components?.securitySchemes?.bearer;

    expect(bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(bearer).not.toMatchObject({
      type: 'apiKey',
      name: 'Authorization',
    });
    expect(bearer).toHaveProperty(
      'description',
      expect.stringContaining('raw accessToken JWT'),
    );
  });

  it('keeps persisted credentials scoped to the browser', () => {
    const html = generateDocsHtml('/api/docs-json');

    expect(html).toContain('"persistAuth":true');
    expect(html).not.toContain('eyJ');
  });
});
