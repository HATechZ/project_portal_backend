import { Module } from '@nestjs/common';
import { EngineeringDocumentCodeController } from './engineering-document-code.controller';
import { EngineeringDocumentCodeService } from './engineering-document-code.service';
import { EngineeringDocumentCodeRepository } from './repositories/engineering-document-code.repository';

@Module({
  controllers: [EngineeringDocumentCodeController],
  providers: [
    EngineeringDocumentCodeService,
    EngineeringDocumentCodeRepository,
  ],
})
export class EngineeringDocumentCodeModule {}
