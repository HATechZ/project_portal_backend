import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AppErrorCode } from '../exceptions/app-error-code';
import { ApiResponseDto } from '../dto/api-response.dto';
import {
  ApiErrorDto,
  ApiErrorMetaDto,
  ApiErrorResponseDto,
} from '../dto/api-error-response.dto';

function responseSchema<TModel extends Type<unknown>>(model: TModel) {
  return {
    allOf: [
      { $ref: getSchemaPath(ApiResponseDto) },
      {
        properties: {
          data: { $ref: getSchemaPath(model) },
        },
      },
    ],
  };
}

function arrayResponseSchema<TModel extends Type<unknown>>(model: TModel) {
  return {
    allOf: [
      { $ref: getSchemaPath(ApiResponseDto) },
      {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
        },
      },
    ],
  };
}

export function ApiStandardOkResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Request successful',
) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiOkResponse({ description, schema: responseSchema(model) }),
  );
}

export function ApiStandardCreatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Resource created',
) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiCreatedResponse({ description, schema: responseSchema(model) }),
  );
}

export function ApiStandardArrayResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Request successful',
) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiOkResponse({ description, schema: arrayResponseSchema(model) }),
  );
}

interface ErrorExample {
  summary: string;
  message: string | string[];
  details?: unknown;
}

function errorResponseDecorators(
  status: number,
  code: AppErrorCode,
  description: string,
  examples: Record<string, ErrorExample>,
) {
  const timestamp = '2026-08-20T10:30:00.000Z';
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto, ApiErrorDto, ApiErrorMetaDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
          examples: Object.fromEntries(
            Object.entries(examples).map(
              ([name, { summary, message, details }]) => [
                name,
                {
                  summary,
                  value: {
                    success: false,
                    error: {
                      code,
                      message,
                      ...(details === undefined ? {} : { details }),
                    },
                    meta: {
                      requestId: 'c4c23a61-ffbb-4b27-9756-98382f74594b',
                      timestamp,
                    },
                  },
                },
              ],
            ),
          ),
        },
      },
    }),
  );
}

export function ApiStandardBadRequestResponse(
  description = 'The request is invalid',
) {
  return errorResponseDecorators(400, AppErrorCode.BadRequest, description, {
    validation: {
      summary: 'Validation failed',
      message: [
        'email must be an email',
        'password must be longer than or equal to 6 characters',
      ],
    },
    tenant: {
      summary: 'Tenant header is missing or invalid',
      message: 'x-tenant-id is required',
    },
  });
}

export function ApiStandardUnauthorizedResponse(
  message = 'Authentication required',
) {
  return errorResponseDecorators(401, AppErrorCode.Unauthorized, message, {
    unauthorized: { summary: message, message },
  });
}

export function ApiStandardForbiddenResponse(
  message = 'Access to this resource is forbidden',
) {
  return errorResponseDecorators(403, AppErrorCode.Forbidden, message, {
    forbidden: { summary: message, message },
    tenantMismatch: {
      summary: 'Tenant does not match the authenticated session',
      message: 'The requested tenant does not match the authenticated session',
    },
  });
}

export function ApiStandardNotFoundResponse(
  description = 'Resource was not found',
  message = description,
) {
  return errorResponseDecorators(404, AppErrorCode.NotFound, description, {
    notFound: { summary: description, message },
  });
}

export function ApiStandardConflictResponse(
  description = 'Request conflicts with the current resource state',
  message = description,
) {
  return errorResponseDecorators(409, AppErrorCode.Conflict, description, {
    conflict: { summary: description, message },
  });
}
