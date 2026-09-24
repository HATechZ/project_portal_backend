import { Injectable } from '@nestjs/common';
import { GeneralDocumentCodeRepository } from './repositories/general-document-code.repository';
import { GeneralDocumentCodeServiceBase } from './providers/general-document-code.service-base';

@Injectable()
export class GeneralDocumentCodeService extends GeneralDocumentCodeServiceBase {
  constructor(codes: GeneralDocumentCodeRepository) {
    super(codes);
  }
}
