import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { paginate, PaginationArgs } from '../../common/pagination/paginate';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { PaginatedResult } from '../../common/pagination/paginated-result';
import {
  CreateDesignationDto,
  DesignationResponseDto,
  UpdateDesignationDto,
} from '../dtos';
import { DesignationRecord, DesignationRepository } from '../repositories';

export abstract class DesignationServiceBase {
  protected constructor(private readonly repository: DesignationRepository) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<DesignationResponseDto>> {
    const companyId = await this.requireCompany();
    return paginate(
      query,
      async (args: PaginationArgs) =>
        (await this.repository.list(companyId, args)).map((record) =>
          this.toResponse(record),
        ),
      () => this.repository.count(companyId),
    );
  }

  async findOne(id: string): Promise<DesignationResponseDto> {
    return this.toResponse(
      await this.requireDesignation(id, await this.requireCompany()),
    );
  }

  async create(input: CreateDesignationDto): Promise<DesignationResponseDto> {
    const companyId = await this.requireCompany();
    await this.assertUnique(input.name, companyId);
    return this.toResponse(await this.repository.create(companyId, input.name));
  }

  async update(
    id: string,
    input: UpdateDesignationDto,
  ): Promise<DesignationResponseDto> {
    if (input.name === undefined) throw this.badRequest();
    const companyId = await this.requireCompany();
    await this.requireDesignation(id, companyId);
    await this.assertUnique(input.name, companyId, id);
    return this.toResponse(
      await this.repository.update(id, companyId, input.name),
    );
  }

  async delete(id: string): Promise<void> {
    const companyId = await this.requireCompany();
    await this.requireDesignation(id, companyId);
    if (await this.repository.hasMembers(id, companyId)) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'This designation cannot be deleted because Members still reference it.',
      });
    }
    await this.repository.delete(id, companyId);
  }

  private async requireCompany(): Promise<string> {
    const companyId = await this.repository.companyId();
    if (companyId) return companyId;
    throw new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message:
        'Company not found. It may have been removed or you may not have access to it.',
    });
  }

  private async requireDesignation(
    id: string,
    companyId: string,
  ): Promise<DesignationRecord> {
    const designation = await this.repository.find(id, companyId);
    if (designation) return designation;
    throw new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message: 'Designation was not found.',
    });
  }

  private async assertUnique(
    name: string,
    companyId: string,
    exceptId?: string,
  ): Promise<void> {
    if (!(await this.repository.duplicate(name, companyId, exceptId))) return;
    throw new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message: 'A designation with the same name already exists.',
    });
  }

  private badRequest(): AppException {
    return new AppException({
      code: AppErrorCode.BadRequest,
      status: HttpStatus.BAD_REQUEST,
      message:
        'Some information is invalid. Correct the highlighted fields and try again.',
    });
  }

  private toResponse(record: DesignationRecord): DesignationResponseDto {
    return {
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
