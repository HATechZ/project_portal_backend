import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import {
  AssignDivisionLeadDto,
  CreateDivisionDto,
  DivisionLeadDetailDto,
  DivisionLeadResponseDto,
  DivisionResponseDto,
  UpdateDivisionDto,
} from './dtos';
import {
  toDivisionLeadDetail,
  toDivisionLeadResponse,
  toDivisionResponse,
} from './providers';
import {
  DivisionLeadRepository,
  DivisionRepository,
  ScopedCompanyRecord,
} from './repositories';

@Injectable()
export class DivisionService {
  constructor(
    private readonly repository: DivisionRepository,
    private readonly leadRepository: DivisionLeadRepository,
  ) {}

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
    await this.assertUniqueName(input.name, company.id);
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
    if (input.name !== undefined) {
      await this.assertUniqueName(input.name, company.id, id);
    }
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
        message:
          'This division cannot be deleted because related records still depend on it. Remove or reassign those records first.',
      });
    }
    await this.repository.delete(id, company.id);
  }

  async assignLead(
    divisionId: string,
    input: AssignDivisionLeadDto,
    assignedByUserId: string,
  ): Promise<DivisionLeadResponseDto> {
    const company = await this.requireScopedCompany();
    return toDivisionLeadResponse(
      await this.leadRepository.assign({
        companyId: company.id,
        divisionId,
        memberId: input.memberId,
        assignedByUserId,
      }),
    );
  }

  async revokeLead(
    divisionId: string,
    revokedByUserId: string,
  ): Promise<DivisionLeadDetailDto> {
    const company = await this.requireScopedCompany();
    await this.requireDivision(divisionId, company.id);
    return toDivisionLeadDetail(
      await this.leadRepository.revoke({
        companyId: company.id,
        divisionId,
        revokedByUserId,
      }),
    );
  }

  /** Null, not 404 — a Lead-less Division is valid (04.1.1 DR-10). */
  async findLead(divisionId: string): Promise<DivisionLeadDetailDto | null> {
    const company = await this.requireScopedCompany();
    await this.requireDivision(divisionId, company.id);
    const lead = await this.leadRepository.findActiveLead(
      divisionId,
      company.id,
    );
    return lead ? toDivisionLeadDetail(lead) : null;
  }

  private async requireScopedCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.repository.findScopedCompany();
    if (!company) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message:
          'Company not found. It may have been removed or you may not have access to it.',
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
        message:
          'Division not found. It may have been removed or you may not have access to it.',
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
        message: 'The selected value is invalid.',
      });
    }
  }

  private async assertUniqueName(
    name: string,
    companyId: string,
    exceptId?: string,
  ): Promise<void> {
    if (!(await this.repository.duplicateName(name, companyId, exceptId)))
      return;
    throw new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message: 'A division with the same name already exists.',
    });
  }

  private assertUpdateHasFields(input: UpdateDivisionDto): void {
    if (
      input.name === undefined &&
      input.abbr === undefined &&
      input.divisionTypeId === undefined
    ) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message:
          'Some information is invalid. Correct the highlighted fields and try again.',
      });
    }
  }
}
