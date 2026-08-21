import { generateDocsHtml } from './openapi.module';

describe('OpenApiModule docs page', () => {
  it('initializes Scalar with credentialed fetch for session cookies', () => {
    const html = generateDocsHtml('/api/docs-json');

    expect(html).toContain("credentials: 'include'");
    expect(html).toContain(
      "Scalar.createApiReference('#api-reference', configuration)",
    );
    expect(html).toContain('"url":"/api/docs-json"');
    expect(html).not.toContain('data-configuration');
    expect(html).not.toContain('preferredSecurityScheme');
  });
});
