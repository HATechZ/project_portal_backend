import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { PaginatedResult } from '../../common/pagination/paginated-result';
import { paginate } from '../../common/pagination/paginate';
import { CompanyResponseDto, CompanyTypeResponseDto } from '../dtos';
import { CompanyRepository } from '../repositories';
import { toCompanyResponse, toCompanyTypeResponse } from './company.mapper';

@Injectable()
export class CompanyQueryProvider {
  constructor(private readonly repository: CompanyRepository) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CompanyResponseDto>> {
    return paginate(
      query,
      async (args) =>
        (await this.repository.findAll(args)).map(toCompanyResponse),
      () => this.repository.count(),
    );
  }

  async findOne(id: string): Promise<CompanyResponseDto> {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message:
          'Company not found. It may have been removed or you may not have access to it.',
      });
    }
    return toCompanyResponse(company);
  }

  async findCompanyTypes(): Promise<CompanyTypeResponseDto[]> {
    return (await this.repository.findCompanyTypes()).map(
      toCompanyTypeResponse,
    );
  }
}
