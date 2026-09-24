import { Injectable } from '@nestjs/common';
import { EtcDocumentCodeRepository } from './repositories/etc-document-code.repository';
import { EtcDocumentCodeServiceBase } from './providers/etc-document-code.service-base';
@Injectable()
export class EtcDocumentCodeService extends EtcDocumentCodeServiceBase {
  constructor(codes: EtcDocumentCodeRepository) {
    super(codes);
  }
}
