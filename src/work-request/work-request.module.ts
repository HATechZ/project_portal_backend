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
import { WorkRequestAssignmentController } from './work-request-assignment.controller';
import { WorkRequestAssignmentProvider } from './providers/work-request-assignment.provider';
import { WorkRequestAssignmentRepository } from './repositories/work-request-assignment.repository';
import { WorkRequestAssignmentReadRepository } from './repositories/work-request-assignment-read.repository';
import { WorkRequestWorkflowController } from './work-request-workflow.controller';
import { WorkRequestWorkflowProvider } from './providers/work-request-workflow.provider';
import { WorkRequestWorkflowRepository } from './repositories/work-request-workflow.repository';
import { WorkRequestInfoController } from './work-request-info.controller';
import { WorkRequestInfoRepository } from './repositories/work-request-info.repository';
import { WorkRequestInfoProvider } from './providers/work-request-info.provider';
@Module({
  controllers: [
    WorkRequestController,
    WorkRequestDocumentController,
    WorkRequestHistoryController,
    WorkRequestAssignmentController,
    WorkRequestWorkflowController,
    WorkRequestInfoController,
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
    WorkRequestAssignmentRepository,
    WorkRequestAssignmentReadRepository,
    WorkRequestAssignmentProvider,
    WorkRequestWorkflowRepository,
    WorkRequestWorkflowProvider,
    WorkRequestInfoRepository,
    WorkRequestInfoProvider,
  ],
})
export class WorkRequestModule {}
