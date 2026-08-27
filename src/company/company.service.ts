import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { PaginatedResult } from '../common/pagination/paginated-result';
import {
  CompanyResponseDto,
  CompanyTypeResponseDto,
  CreateCompanyDto,
} from './dtos';
import { CompanyMutationProvider, CompanyQueryProvider } from './providers';

@Injectable()
export class CompanyService {
  constructor(
    private readonly mutationProvider: CompanyMutationProvider,
    private readonly queryProvider: CompanyQueryProvider,
  ) {}

  create(input: CreateCompanyDto): Promise<CompanyResponseDto> {
    return this.mutationProvider.create(input);
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
