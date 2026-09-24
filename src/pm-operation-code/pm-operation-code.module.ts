import { Module } from '@nestjs/common';
import { PmOperationDocumentCodeController } from './pm-operation-code.controller';
import { PmOperationDocumentCodeService } from './pm-operation-code.service';
import { PmOperationDocumentCodeRepository } from './repositories/pm-operation-code.repository';

@Module({
  controllers: [PmOperationDocumentCodeController],
  providers: [
    PmOperationDocumentCodeService,
    PmOperationDocumentCodeRepository,
  ],
})
export class PmOperationDocumentCodeModule {}
