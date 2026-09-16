import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { SessionAdministrationRepository } from './repositories/session-administration.repository';

@Injectable()
export class SessionAdministrationService {
  constructor(private readonly repository: SessionAdministrationRepository) {}

  async revokeForUser(userId: string): Promise<void> {
    if (!(await this.repository.revokeForUser(userId))) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'User not found. Check the selected user and try again.',
      });
    }
  }
}
