import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanySignupController } from './company-signup.controller';
import { CompanyTypeController } from './company-type.controller';
import { CompanySignupService } from './company-signup.service';
import { CompanyService } from './company.service';
import { CompanyUpdateService } from './company-update.service';
import { CompanyQueryProvider } from './providers';
import { CompanyRepository, CompanySignupRepository } from './repositories';

@Module({
  controllers: [
    CompanyController,
    CompanySignupController,
    CompanyTypeController,
  ],
  providers: [
    CompanyService,
    CompanyUpdateService,
    CompanySignupService,
    CompanyQueryProvider,
    CompanyRepository,
    CompanySignupRepository,
  ],
  exports: [CompanyQueryProvider],
})
export class CompanyModule {}
