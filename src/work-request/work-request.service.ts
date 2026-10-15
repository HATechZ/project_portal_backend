import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { WorkRequestActionsProvider } from './providers/work-request-actions.provider';
import { WorkRequestServiceBase } from './providers/work-request-service-base';
import { WorkRequestStorageProvider } from './providers/work-request-storage.provider';
import { WorkRequestDocumentHistoryProvider } from './providers/work-request-document-history.provider';
import { WorkRequestRepository } from './repositories/work-request.repository';
import { WorkRequestReadRepository } from './repositories/work-request-read.repository';
import { WorkRequestEventRepository } from './repositories/work-request-event.repository';
import { WorkRequestNamingProvider } from './providers/work-request-naming.provider';
import { WorkRequestAssignmentProvider } from './providers/work-request-assignment.provider';
import {
  AssignDivisionDto,
  AssignMemberDto,
  AssignReviewerDto,
  AssignTeamDto,
} from './dtos/work-request.dto';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
} from './dtos/work-request.dto';
import { WorkRequestInfoProvider } from './providers/work-request-info.provider';
import type { SessionActor } from '../common/security/session.types';
import { WorkRequestWorkflowProvider } from './providers/work-request-workflow.provider';
import { DocumentUploadRequestRepository } from '../common/documents/document-upload-request.repository';
import {
  WorkRequestActionDto,
  WorkRequestWorkflowNoteDto,
  CreateWorkRequestClientSubmissionDto,
  RouteWorkRequestClientRevisionDto,
  WorkRequestClientDecisionDto,
} from './dtos/work-request.dto';
import { WorkRequestClientSubmissionProvider } from './providers/work-request-client-submission.provider';

export type WorkRequestUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class WorkRequestService extends WorkRequestServiceBase {
  constructor(
    repository: WorkRequestRepository,
    reads: WorkRequestReadRepository,
    eventsRepository: WorkRequestEventRepository,
    uow: UnitOfWorkService,
    storageProvider: WorkRequestStorageProvider,
    actions: WorkRequestActionsProvider,
    history: WorkRequestDocumentHistoryProvider,
    naming: WorkRequestNamingProvider,
    private readonly assignments: WorkRequestAssignmentProvider,
    private readonly workflow: WorkRequestWorkflowProvider,
    private readonly info: WorkRequestInfoProvider,
    private readonly clientLifecycle: WorkRequestClientSubmissionProvider,
    @Inject(FILE_STORAGE) storage: FileStorage,
    receipts?: DocumentUploadRequestRepository,
  ) {
    super(
      repository,
      reads,
      eventsRepository,
      uow,
      storageProvider,
      actions,
      history,
      naming,
      storage,
      receipts,
    );
  }

  assignDivision(id: string, input: AssignDivisionDto, actor: SessionActor) {
    return this.assignments.division(id, input, actor);
  }

  assignTeam(id: string, input: AssignTeamDto, actor: SessionActor) {
    return this.assignments.team(id, input, actor);
  }

  assignMember(id: string, input: AssignMemberDto, actor: SessionActor) {
    return this.assignments.member(id, input, actor);
  }

  assignReviewer(id: string, input: AssignReviewerDto, actor: SessionActor) {
    return this.assignments.reviewer(id, input, actor);
  }

  assignmentHistory(id: string, actor: SessionActor) {
    return this.assignments.history(id, actor);
  }

  submit(id: string, input: WorkRequestWorkflowNoteDto, actor: SessionActor) {
    return this.workflow.submit(id, input, actor);
  }

  action(id: string, input: WorkRequestActionDto, actor: SessionActor) {
    return this.workflow.action(
      id,
      input.actionId,
      input.actionCode,
      input.note,
      actor,
    );
  }

  requestInfo(
    id: string,
    input: CreateWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.info.request(id, input, actor);
  }
  respondInfo(
    id: string,
    infoRequestId: string,
    input: RespondWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.info.respond(id, infoRequestId, input, actor);
  }
  infoHistory(id: string, actor: SessionActor) {
    return this.info.history(id, actor);
  }
  submitClientPackage(id: string, input: CreateWorkRequestClientSubmissionDto, actor: SessionActor) { return this.clientLifecycle.submit(id, input, actor); }
  clientSubmissions(id: string, actor: SessionActor) { return this.clientLifecycle.list(id, actor); }
  clientDecision(id: string, submissionId: string, input: WorkRequestClientDecisionDto, actor: SessionActor) { return this.clientLifecycle.decide(id, submissionId, input, actor); }
  routeClientRevision(id: string, input: RouteWorkRequestClientRevisionDto, actor: SessionActor) { return this.clientLifecycle.route(id, input, actor); }
}
