import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  EngineeringDocumentCodeRepository,
  EngineeringDocumentCodeStatus,
} from '../repositories/engineering-document-code.repository';

export abstract class EngineeringDocumentCodeServiceBase {
  protected constructor(
    private readonly codes: EngineeringDocumentCodeRepository,
  ) {}
  findAll(status: EngineeringDocumentCodeStatus = 'active') {
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
    if (Object.values(input).every((value) => value === undefined))
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Supply a value to update.',
      });
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
    if (current.isActive === isActive)
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: isActive
          ? 'Engineering Document Code is already active.'
          : 'Engineering Document Code is already inactive.',
      });
    return this.codes.setActive(id, isActive);
  }
  private async requireCode(id: string) {
    const code = await this.codes.find(id);
    if (code) return code;
    throw new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message: 'Engineering Document Code was not found.',
    });
  }
  private async assertUnique(code: string, exceptId?: string) {
    if (!(await this.codes.duplicate(code, exceptId))) return;
    throw new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message:
        'An Engineering Document Code with the same code already exists.',
    });
  }
}
