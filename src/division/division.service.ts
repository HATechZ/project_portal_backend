import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import {
  CreateDivisionDto,
  DivisionResponseDto,
  UpdateDivisionDto,
} from './dtos';
import { toDivisionResponse } from './providers';
import { DivisionRepository, ScopedCompanyRecord } from './repositories';

@Injectable()
export class DivisionService {
  constructor(private readonly repository: DivisionRepository) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<DivisionResponseDto>> {
    const company = await this.requireScopedCompany();
    return paginate(
      query,
      async (args) =>
        (await this.repository.findAll(company.id, args)).map(
          toDivisionResponse,
        ),
      () => this.repository.count(company.id),
    );
  }

  async findOne(id: string): Promise<DivisionResponseDto> {
    const company = await this.requireScopedCompany();
    return toDivisionResponse(await this.requireDivision(id, company.id));
  }

  async create(input: CreateDivisionDto): Promise<DivisionResponseDto> {
    const company = await this.requireScopedCompany();
    await this.assertDivisionType(input.divisionTypeId);
    return toDivisionResponse(await this.repository.create(company.id, input));
  }

  async update(
    id: string,
    input: UpdateDivisionDto,
  ): Promise<DivisionResponseDto> {
    this.assertUpdateHasFields(input);
    const company = await this.requireScopedCompany();
    await this.requireDivision(id, company.id);
    await this.assertDivisionType(input.divisionTypeId);
    return toDivisionResponse(
      await this.repository.update(id, company.id, input),
    );
  }

  async delete(id: string): Promise<void> {
    const company = await this.requireScopedCompany();
    await this.requireDivision(id, company.id);
    const blockers = await this.repository.findDeleteBlockers(id, company.id);
    if (blockers.length > 0) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: 'Division has dependent records and cannot be deleted',
        details: { blockers },
      });
    }
    await this.repository.delete(id, company.id);
  }

  private async requireScopedCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.repository.findScopedCompany();
    if (!company) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Company was not found for the active Tenant',
      });
    }
    return company;
  }

  private async requireDivision(id: string, companyId: string) {
    const division = await this.repository.findById(id, companyId);
    if (!division) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: `Division with ID ${id} was not found`,
      });
    }
    return division;
  }

  private async assertDivisionType(divisionTypeId?: string): Promise<void> {
    if (
      divisionTypeId !== undefined &&
      !(await this.repository.findDivisionType(divisionTypeId))
    ) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Unknown divisionTypeId',
      });
    }
  }

  private assertUpdateHasFields(input: UpdateDivisionDto): void {
    if (
      input.name === undefined &&
      input.abbr === undefined &&
      input.divisionTypeId === undefined
    ) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Supply name, abbr, or divisionTypeId',
      });
    }
  }
}
