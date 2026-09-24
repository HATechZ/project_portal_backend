import { Injectable } from '@nestjs/common';
import { EngineeringDocumentCodeRepository } from './repositories/engineering-document-code.repository';
import { EngineeringDocumentCodeServiceBase } from './providers/engineering-document-code.service-base';
@Injectable()
export class EngineeringDocumentCodeService extends EngineeringDocumentCodeServiceBase {
  constructor(codes: EngineeringDocumentCodeRepository) {
    super(codes);
  }
}
