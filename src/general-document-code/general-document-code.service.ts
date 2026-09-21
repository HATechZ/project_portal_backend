import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import {
  GeneralDocumentCodeRepository,
  GeneralDocumentCodeStatus,
} from './repositories/general-document-code.repository';

@Injectable()
export class GeneralDocumentCodeService {
  constructor(private readonly codes: GeneralDocumentCodeRepository) {}

  findAll(status: GeneralDocumentCodeStatus = 'active') {
    return this.codes.list(status);
  }

  findDeactivated() {
    return this.codes.list('inactive');
  }

  async findOne(id: string) {
    return this.requireCode(id);
  }

  async create(input: { code: string; name: string; description?: string }) {
    await this.assertUnique(input.code);
    return this.codes.create(input);
  }

  async update(
    id: string,
    input: { code?: string; name?: string; description?: string },
  ) {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Supply a value to update.',
      });
    }
    const current = await this.requireCode(id);
    await this.assertUnique(input.code ?? current.code, id);
    return this.codes.update(id, input);
  }

  async deactivate(id: string) {
    return this.setActive(id, false);
  }

  async reactivate(id: string) {
    return this.setActive(id, true);
  }

  private async setActive(id: string, isActive: boolean) {
    const current = await this.requireCode(id);
    if (current.isActive === isActive) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: isActive
          ? 'General Document Code is already active.'
          : 'General Document Code is already inactive.',
      });
    }
    return this.codes.setActive(id, isActive);
  }

  private async requireCode(id: string) {
    const code = await this.codes.find(id);
    if (code) return code;
    throw new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message: 'General Document Code was not found.',
    });
  }

  private async assertUnique(code: string, exceptId?: string) {
    if (!(await this.codes.duplicate(code, exceptId))) return;
    throw new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message: 'A General Document Code with the same code already exists.',
    });
  }
}
