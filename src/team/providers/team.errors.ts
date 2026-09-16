import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';

export function teamNotFound(id: string): AppException {
  void id;
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message:
      'Team not found. It may have been removed or you may not have access to it.',
  });
}

export function teamScopeConflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
