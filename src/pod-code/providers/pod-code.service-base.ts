import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ActorScopeContext } from '../../common/security/object-scope.provider';
import {
  OptionValueRecord,
  PodCodeRepository,
} from '../repositories/pod-code.repository';

export abstract class PodCodeServiceBase {
  protected constructor(
    protected readonly values: PodCodeRepository,
    private readonly hasCode: boolean,
  ) {}
  protected async list(includeInactive = false) {
    return this.values.list(includeInactive);
  }
  protected async one(id: string) {
    const row = await this.values.find(id);
    if (!row) throw this.notFound();
    return row;
  }
  protected assertManagement(scope: ActorScopeContext) {
    if (!scope.tenantWide)
      throw new AppException({
        code: AppErrorCode.OutOfScope,
        status: HttpStatus.FORBIDDEN,
        message: "You don't have access to this resource.",
      });
  }
  protected async createValue(
    input: { name: string; code?: string },
    scope: ActorScopeContext,
  ) {
    this.assertManagement(scope);
    await this.assertUnique(input);
    return this.values.create(input);
  }
  protected async updateValue(
    id: string,
    input: { name?: string; code?: string },
    scope: ActorScopeContext,
  ) {
    this.assertManagement(scope);
    await this.one(id);
    if (await this.values.isReferenced(id))
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'This referenced value cannot be renamed until the owner decision is approved.',
      });
    if (input.name === undefined && input.code === undefined)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Supply a value to update.',
      });
    await this.assertUnique(
      {
        name: input.name ?? (await this.one(id)).name,
        ...(this.hasCode
          ? { code: input.code ?? (await this.one(id)).code ?? '' }
          : {}),
      },
      id,
    );
    return this.values.update(id, input);
  }
  protected async lifecycleValue(
    id: string,
    active: boolean,
    scope: ActorScopeContext,
  ) {
    this.assertManagement(scope);
    const row = await this.one(id);
    if (row.isActive === active)
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: active
          ? 'Value is already active.'
          : 'Value is already inactive.',
      });
    return this.values.setActive(id, active);
  }
  private async assertUnique(
    input: { name: string; code?: string },
    exceptId?: string,
  ) {
    if (
      await this.values.duplicate(
        input.name,
        this.hasCode ? input.code : undefined,
        exceptId,
      )
    )
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: 'A value with the same name or code already exists.',
      });
  }
  private notFound() {
    return new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message: 'Reference value was not found.',
    });
  }
  protected static row<T extends OptionValueRecord>(
    row: T,
    includeCode: boolean,
  ) {
    if (includeCode) return row;
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
