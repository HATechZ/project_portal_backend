import { Injectable } from '@nestjs/common';
import { MarketingDocumentCodeRepository } from './repositories/marketing-document-code.repository';
import { MarketingDocumentCodeServiceBase } from './providers/marketing-document-code.service-base';
@Injectable()
export class MarketingDocumentCodeService extends MarketingDocumentCodeServiceBase {
  constructor(codes: MarketingDocumentCodeRepository) {
    super(codes);
  }
}
