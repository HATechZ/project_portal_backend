import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { UpdateMemberDto } from '../dtos';

export function memberNotFound(id: string): AppException {
  void id;
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message:
      'Member not found. It may have been removed or you may not have access to it.',
  });
}

export function scopedCompanyNotFound(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message:
      'Company not found. It may have been removed or you may not have access to it.',
  });
}

export function assertMemberUpdateHasFields(input: UpdateMemberDto): void {
  if (
    input.name === undefined &&
    input.email === undefined &&
    input.roleTitle === undefined &&
    input.divisionId === undefined &&
    input.isActive === undefined
  ) {
    throw new AppException({
      code: AppErrorCode.BadRequest,
      message:
        'Some information is invalid. Correct the highlighted fields and try again.',
    });
  }
}
