import { Module } from '@nestjs/common';
import { MarketingDocumentCodeController } from './marketing-document-code.controller';
import { MarketingDocumentCodeService } from './marketing-document-code.service';
import { MarketingDocumentCodeRepository } from './repositories/marketing-document-code.repository';

@Module({
  controllers: [MarketingDocumentCodeController],
  providers: [MarketingDocumentCodeService, MarketingDocumentCodeRepository],
})
export class MarketingDocumentCodeModule {}
