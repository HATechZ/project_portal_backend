import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { UpdateMemberDto } from '../dtos';

export function memberNotFound(id: string): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: `Member with ID ${id} was not found`,
  });
}

export function scopedCompanyNotFound(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: 'Company was not found for the active Tenant',
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
      message: 'Supply at least one Member field',
    });
  }
}
