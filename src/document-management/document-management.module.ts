import { Module } from '@nestjs/common';
import { DocumentManagementController } from './document-management.controller';
import { DocumentManagementRepository } from './document-management.repository';
import { DocumentManagementService } from './document-management.service';

@Module({
  controllers: [DocumentManagementController],
  providers: [DocumentManagementService, DocumentManagementRepository],
})
export class DocumentManagementModule {}
