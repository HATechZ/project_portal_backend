import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { CompanyResponseDto, CompanyTypeResponseDto } from './dtos';
import { CompanyQueryProvider } from './providers';
import { CompanyUpdateService } from './company-update.service';
import { UpdateCompanyDto } from './dtos/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly queryProvider: CompanyQueryProvider,
    private readonly updateService: CompanyUpdateService,
  ) {}

  update(id: string, input: UpdateCompanyDto): Promise<CompanyResponseDto> {
    return this.updateService.update(id, input);
  }

  findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CompanyResponseDto>> {
    return this.queryProvider.findAll(query);
  }

  findOne(id: string): Promise<CompanyResponseDto> {
    return this.queryProvider.findOne(id);
  }

  findCompanyTypes(): Promise<CompanyTypeResponseDto[]> {
    return this.queryProvider.findCompanyTypes();
  }
}
