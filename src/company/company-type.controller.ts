import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardArrayResponse } from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CompanyService } from './company.service';
import { CompanyTypeResponseDto } from './dtos';

@ApiTags('company')
@Controller()
export class CompanyTypeController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('company-type')
  @ResponseMessage('Company types returned successfully')
  @ApiOperation({ summary: 'List CompanyType signup references' })
  @ApiStandardArrayResponse(CompanyTypeResponseDto)
  findAll() {
    return this.companyService.findCompanyTypes();
  }
}
