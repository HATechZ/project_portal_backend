import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../pagination/paginated-result';

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(model, PaginationMeta),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: { $ref: getSchemaPath(PaginationMeta) },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  requestId: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        ],
      },
    }),
  );
}
