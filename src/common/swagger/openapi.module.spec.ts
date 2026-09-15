import {
  buildOpenApiConfig,
  generateDocsHtml,
  normalizeScalarFinalAuthorization,
} from './openapi.module';

const bearerSecurity = [
  { in: 'header', name: 'Authorization', format: 'bearer' },
];

describe('Scalar docs security configuration', () => {
  it('declares native HTTP bearer and tenant API-key security', () => {
    const document = buildOpenApiConfig();

    expect(document.components?.securitySchemes).toMatchObject({
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      tenant: { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
    });
  });

  it('normalizes a raw JWT to one bearer Authorization value', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer access.jwt.value' },
    });

    normalizeScalarFinalAuthorization({
      request,
      requestBuilder: { security: bearerSecurity },
    });

    expect(request.headers.get('Authorization')).toBe('Bearer access.jwt.value');
  });

  it('normalizes an already-prefixed JWT without duplicating Bearer', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer Bearer access.jwt.value' },
    });

    normalizeScalarFinalAuthorization({
      request,
      requestBuilder: { security: bearerSecurity },
    });

    expect(request.headers.get('Authorization')).toBe('Bearer access.jwt.value');
  });

  it('removes Authorization when no bearer token is present', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer' },
    });

    normalizeScalarFinalAuthorization({
      request,
      requestBuilder: { security: bearerSecurity },
    });

    expect(request.headers.has('Authorization')).toBe(false);
  });

  it('removes the empty native bearer value appended after a JWT', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer access.jwt.value, Bearer' },
    });

    normalizeScalarFinalAuthorization({
      request,
      requestBuilder: { security: bearerSecurity },
    });

    expect(request.headers.get('Authorization')).toBe('Bearer access.jwt.value');
    expect(request.headers.get('Authorization')).not.toContain(',');
    expect(Array.from(request.headers.keys()).filter((key) => key === 'authorization')).toHaveLength(1);
  });

  it('preserves x-tenant-id while normalizing bearer Authorization', () => {
    const request = new Request('https://example.test', {
      headers: {
        Authorization: 'Bearer access.jwt.value, Bearer',
        'x-tenant-id': 'tenant-id-value',
      },
    });

    normalizeScalarFinalAuthorization({
      request,
      requestBuilder: { security: bearerSecurity },
    });

    expect(request.headers.get('Authorization')).toBe('Bearer access.jwt.value');
    expect(request.headers.get('x-tenant-id')).toBe('tenant-id-value');
  });

  it('passes the final-request normalization hook to the pinned browser runtime', () => {
    const html = generateDocsHtml('/docs-json');
    const createApiReference = jest.fn();
    const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/)?.[1];

    expect(html).toContain(
      'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.68.0',
    );
    expect(inlineScript).toBeDefined();

    new Function('Scalar', inlineScript ?? '')({ createApiReference });

    expect(createApiReference).toHaveBeenCalledWith(
      '#api-reference',
      expect.objectContaining({
        url: '/docs-json',
        onRequestBuilt: expect.any(Function),
      }),
    );
  });
});
