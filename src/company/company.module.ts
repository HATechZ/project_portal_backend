import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyMutationProvider, CompanyQueryProvider } from './providers';
import { CompanyRepository } from './repositories';

@Module({
  controllers: [CompanyController],
  providers: [
    CompanyService,
    CompanyMutationProvider,
    CompanyQueryProvider,
    CompanyRepository,
  ],
  exports: [CompanyQueryProvider],
})
export class CompanyModule {}
