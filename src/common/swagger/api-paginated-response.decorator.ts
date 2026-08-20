import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';
import { PaginationMeta } from '../pagination/paginated-result';

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model, PaginationMeta),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
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
            },
          },
        ],
      },
    }),
  );
}
