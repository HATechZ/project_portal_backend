import { Module } from '@nestjs/common';
import { WorkRequestController } from './work-request.controller';
import { WorkRequestExecutionController } from './work-request-execution.controller';
import { WorkRequestRevisionController } from './work-request-revision.controller';
import { WorkRequestService } from './work-request.service';
import { WorkRequestRepository } from './repositories/work-request.repository';
import { WorkRequestExecutionRepository } from './repositories/work-request-execution.repository';
import { WorkRequestExecutionProvider } from './providers/work-request-execution.provider';
import { WorkRequestRevisionProvider } from './providers/work-request-revision.provider';
import { WorkRequestRevisionRepository } from './repositories/work-request-revision.repository';
import { WorkRequestActionsProvider } from './providers/work-request-actions.provider';
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
import { WorkRequestClientSubmissionController } from './work-request-client-submission.controller';
import { WorkRequestClientSubmissionRepository } from './repositories/work-request-client-submission.repository';
import { WorkRequestClientSubmissionProvider } from './providers/work-request-client-submission.provider';
import { DocumentUploadRequestRepository } from '../common/documents/document-upload-request.repository';
import { WorkRequestCommunicationController } from './work-request-communication.controller';
import { WorkRequestCommunicationProvider } from './providers/work-request-communication.provider';
import { WorkRequestCommunicationRepository } from './repositories/work-request-communication.repository';
import { WorkRequestRouteActionsProvider } from './providers/work-request-route-actions.provider';
import { WorkRequestRouteClientRepository } from './repositories/work-request-route-client.repository';
import { WorkRequestRouteClientProvider } from './providers/work-request-route-client.provider';
@Module({
  controllers: [
    WorkRequestController,
    WorkRequestExecutionController,
    WorkRequestRevisionController,
    WorkRequestDocumentController,
    WorkRequestHistoryController,
    WorkRequestAssignmentController,
    WorkRequestWorkflowController,
    WorkRequestInfoController,
    WorkRequestClientSubmissionController,
    WorkRequestCommunicationController,
  ],
  providers: [
    WorkRequestService,
    WorkRequestRepository,
    WorkRequestExecutionRepository,
    WorkRequestExecutionProvider,
    WorkRequestRevisionRepository,
    WorkRequestRevisionProvider,
    WorkRequestReadRepository,
    WorkRequestEventRepository,
    WorkRequestActionsProvider,
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
    WorkRequestClientSubmissionRepository,
    WorkRequestClientSubmissionProvider,
    DocumentUploadRequestRepository,
    WorkRequestCommunicationRepository,
    WorkRequestCommunicationProvider,
    WorkRequestRouteActionsProvider,
    WorkRequestRouteClientRepository,
    WorkRequestRouteClientProvider,
  ],
})
export class WorkRequestModule {}
