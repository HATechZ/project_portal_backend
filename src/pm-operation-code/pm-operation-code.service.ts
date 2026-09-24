import { Injectable } from '@nestjs/common';
import { PmOperationDocumentCodeRepository } from './repositories/pm-operation-code.repository';
import { PmOperationDocumentCodeServiceBase } from './providers/pm-operation-code.service-base';
@Injectable()
export class PmOperationDocumentCodeService extends PmOperationDocumentCodeServiceBase {
  constructor(codes: PmOperationDocumentCodeRepository) {
    super(codes);
  }
}




