import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { WorkRequestActionsProvider } from './providers/work-request-actions.provider';
import { WorkRequestFileProvider } from './providers/work-request-file.provider';
import { WorkRequestResourceScopeProvider } from './providers/work-request-resource-scope.provider';
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
  AssignTeamDto,
} from './dtos/work-request.dto';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
} from './dtos/work-request.dto';
import { WorkRequestInfoProvider } from './providers/work-request-info.provider';
import type { SessionActor } from '../common/security/session.types';
import { WorkRequestWorkflowProvider } from './providers/work-request-workflow.provider';
import {
  WorkRequestActionDto,
  WorkRequestWorkflowNoteDto,
} from './dtos/work-request.dto';

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
    files: WorkRequestFileProvider,
    scope: WorkRequestResourceScopeProvider,
    storageProvider: WorkRequestStorageProvider,
    actions: WorkRequestActionsProvider,
    history: WorkRequestDocumentHistoryProvider,
    naming: WorkRequestNamingProvider,
    private readonly assignments: WorkRequestAssignmentProvider,
    private readonly workflow: WorkRequestWorkflowProvider,
    private readonly info: WorkRequestInfoProvider,
    @Inject(FILE_STORAGE) storage: FileStorage,
  ) {
    super(
      repository,
      reads,
      eventsRepository,
      uow,
      files,
      scope,
      storageProvider,
      actions,
      history,
      naming,
      storage,
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
}
