import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app-exception';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { UpdateCompanyDto } from './dtos/update-company.dto';
import { CompanyRepository } from './repositories';
import { toCompanyResponse } from './providers/company.mapper';

@Injectable()
export class CompanyUpdateService {
  constructor(private readonly repository: CompanyRepository) {}

  async update(id: string, input: UpdateCompanyDto) {
    if (input.name === undefined && input.companyTypeId === undefined) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message:
          'Some information is invalid. Correct the highlighted fields and try again.',
      });
    }
    if (!(await this.repository.findById(id))) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message:
          'Company not found. It may have been removed or you may not have access to it.',
      });
    }
    if (
      input.companyTypeId !== undefined &&
      !(await this.repository.findCompanyType(input.companyTypeId))
    ) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'The selected value is invalid.',
      });
    }
    return toCompanyResponse(await this.repository.update(id, input));
  }
}
