import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AppErrorCode } from './app-error-code';
import { AppException } from './app-exception';
import { HttpExceptionFilter } from './http-exception.filter';

function captureResponse() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/example' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  it.each([
    [
      new BadRequestException('x-tenant-id must be a valid UUID'),
      HttpStatus.BAD_REQUEST,
      'Some information is invalid. Correct the highlighted fields and try again.',
    ],
    [
      new UnauthorizedException('Bearer access token required'),
      HttpStatus.UNAUTHORIZED,
      'Your session has expired or is no longer valid. Sign in again to continue.',
    ],
    [
      new ForbiddenException('System administrator access required'),
      HttpStatus.FORBIDDEN,
      "You don't have permission to perform this action. Contact your administrator if you need access.",
    ],
  ])(
    'uses a plain-language message for HTTP %i errors',
    (exception, statusCode, message) => {
      const { host, status, json } = captureResponse();

      new HttpExceptionFilter().catch(exception, host);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message }) as unknown,
        }),
      );
    },
  );

  it('preserves a safe domain-coded error and validation details', () => {
    const { host, json } = captureResponse();
    new HttpExceptionFilter().catch(
      new AppException({
        code: AppErrorCode.ValidationFailed,
        message:
          'Some information is invalid. Correct the highlighted fields and try again.',
        details: [{ field: 'email', message: 'Enter a valid email address.' }],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: AppErrorCode.ValidationFailed,
          message:
            'Some information is invalid. Correct the highlighted fields and try again.',
          details: [
            { field: 'email', message: 'Enter a valid email address.' },
          ],
        },
      }),
    );
  });

  it('sanitizes unexpected implementation details', () => {
    const { host, json } = captureResponse();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    new HttpExceptionFilter().catch(
      new Error('Prisma constraint users_email_key at src/secret.ts'),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: AppErrorCode.InternalError,
          message:
            "We couldn't complete your request because of an unexpected error. Try again. If the problem continues, contact support.",
        },
      }),
    );
    log.mockRestore();
  });
});
