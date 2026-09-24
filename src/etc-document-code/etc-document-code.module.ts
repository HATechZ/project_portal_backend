import { Module } from '@nestjs/common';
import { EtcDocumentCodeController } from './etc-document-code.controller';
import { EtcDocumentCodeService } from './etc-document-code.service';
import { EtcDocumentCodeRepository } from './repositories/etc-document-code.repository';

@Module({
  controllers: [EtcDocumentCodeController],
  providers: [EtcDocumentCodeService, EtcDocumentCodeRepository],
})
export class EtcDocumentCodeModule {}
