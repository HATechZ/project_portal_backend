import type { OpenAPIObject } from '@nestjs/swagger';

type OpenApiSchemas = NonNullable<
  NonNullable<OpenAPIObject['components']>['schemas']
>;

export const sharedSchemas: OpenApiSchemas = {
  ApiError: {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string' },
      message: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      details: {},
    },
  },
  EnvelopeMeta: {
    type: 'object',
    required: ['timestamp'],
    properties: {
      requestId: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
};
