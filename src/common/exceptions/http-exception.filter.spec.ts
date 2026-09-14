import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
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
    [new BadRequestException('x-tenant-id must be a valid UUID'), HttpStatus.BAD_REQUEST, 'Please check the information you entered and try again.'],
    [new UnauthorizedException('Bearer access token required'), HttpStatus.UNAUTHORIZED, 'Please sign in again to continue.'],
    [new ForbiddenException('System administrator access required'), HttpStatus.FORBIDDEN, 'You do not have permission to do that.'],
  ])('uses a plain-language message for HTTP %i errors', (exception, statusCode, message) => {
    const { host, status, json } = captureResponse();

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(statusCode);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message }),
      }),
    );
  });
});
