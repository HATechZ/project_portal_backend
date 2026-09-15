import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionAdministrationRepository } from './repositories/session-administration.repository';

@Injectable()
export class SessionAdministrationService {
  constructor(private readonly repository: SessionAdministrationRepository) {}

  async revokeForUser(userId: string): Promise<void> {
    if (!(await this.repository.revokeForUser(userId))) {
      throw new NotFoundException('User was not found');
    }
  }
}
