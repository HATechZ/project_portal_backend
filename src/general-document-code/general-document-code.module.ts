import { Module } from '@nestjs/common';
import { GeneralDocumentCodeController } from './general-document-code.controller';
import { GeneralDocumentCodeService } from './general-document-code.service';
import { GeneralDocumentCodeRepository } from './repositories/general-document-code.repository';

@Module({
  controllers: [GeneralDocumentCodeController],
  providers: [GeneralDocumentCodeService, GeneralDocumentCodeRepository],
})
export class GeneralDocumentCodeModule {}
