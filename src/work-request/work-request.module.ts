import { Module } from '@nestjs/common';
import { WorkRequestController } from './work-request.controller';
import { WorkRequestService } from './work-request.service';
import { WorkRequestRepository } from './repositories/work-request.repository';
import { WorkRequestActionsProvider } from './providers/work-request-actions.provider';
import { WorkRequestFileProvider } from './providers/work-request-file.provider';
import { WorkRequestResourceScopeProvider } from './providers/work-request-resource-scope.provider';
import { WorkRequestStorageProvider } from './providers/work-request-storage.provider';
import { WorkRequestDocumentRepository } from './repositories/work-request-document.repository';
import { WorkRequestDocumentHistoryProvider } from './providers/work-request-document-history.provider';
import { WorkRequestDocumentController } from './work-request-document.controller';
import { WorkRequestReadRepository } from './repositories/work-request-read.repository';
import { WorkRequestEventRepository } from './repositories/work-request-event.repository';
import { WorkRequestHistoryController } from './work-request-history.controller';
import { WorkRequestNamingProvider } from './providers/work-request-naming.provider';
import { WorkRequestStorageCleanupRepository } from './repositories/work-request-storage-cleanup.repository';
@Module({
  controllers: [
    WorkRequestController,
    WorkRequestDocumentController,
    WorkRequestHistoryController,
  ],
  providers: [
    WorkRequestService,
    WorkRequestRepository,
    WorkRequestReadRepository,
    WorkRequestEventRepository,
    WorkRequestActionsProvider,
    WorkRequestFileProvider,
    WorkRequestResourceScopeProvider,
    WorkRequestStorageProvider,
    WorkRequestDocumentRepository,
    WorkRequestDocumentHistoryProvider,
    WorkRequestNamingProvider,
    WorkRequestStorageCleanupRepository,
  ],
})
export class WorkRequestModule {}
