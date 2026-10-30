import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { OutboxService } from '../infra/messaging/outbox.service';
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
import { AmendWorkRequestRouteDto } from './dtos/work-request.dto';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
} from './dtos/work-request.dto';
import { WorkRequestInfoProvider } from './providers/work-request-info.provider';
import type { SessionActor } from '../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../common/security/tenant-internal-operations';
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
import { WorkRequestRouteActionsProvider } from './providers/work-request-route-actions.provider';
import { WorkRequestRouteClientProvider } from './providers/work-request-route-client.provider';
import { WorkRequestCommunicationProvider } from './providers/work-request-communication.provider';
import { ObjectScopeProvider } from '../common/security/object-scope.provider';
import { WorkRequestDocumentDownloadProvider } from './providers/work-request-document-download.provider';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';

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
    private readonly routeActions: WorkRequestRouteActionsProvider,
    private readonly routeClient: WorkRequestRouteClientProvider,
    private readonly documentDownloads: WorkRequestDocumentDownloadProvider,
    @Inject(FILE_STORAGE) storage: FileStorage,
    receipts?: DocumentUploadRequestRepository,
    private readonly communications?: WorkRequestCommunicationProvider,
    outbox?: OutboxService,
    objectScope?: ObjectScopeProvider,
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
      outbox,
      objectScope,
    );
  }

  override async availableActions(id: string, actor: SessionActor) {
    const routeActions = await this.routeActions.available(id, actor);
    return routeActions ?? super.availableActions(id, actor);
  }

  downloadDocuments(
    id: string,
    versionIds: string[] | undefined,
    actor: SessionActor,
  ) {
    return this.documentDownloads.download(id, versionIds, actor);
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
  submitClientPackage(
    id: string,
    input: CreateWorkRequestClientSubmissionDto,
    actor: SessionActor,
  ) {
    return this.routeClient
      .isRoute(id)
      .then((route) =>
        route
          ? this.routeClient.submit(id, input, actor)
          : this.clientLifecycle.submit(id, input, actor),
      );
  }
  clientSubmissions(id: string, actor: SessionActor) {
    return this.routeClient
      .isRoute(id)
      .then((route) =>
        route
          ? this.routeClient.list(id, actor)
          : this.clientLifecycle.list(id, actor),
      );
  }
  clientDecision(
    id: string,
    submissionId: string,
    input: WorkRequestClientDecisionDto,
    actor: SessionActor,
  ) {
    return this.routeClient
      .isRoute(id)
      .then((route) =>
        route
          ? this.routeClient.decide(id, submissionId, input, actor)
          : this.clientLifecycle.decide(id, submissionId, input, actor),
      );
  }
  async routeClientRevision(
    id: string,
    input: RouteWorkRequestClientRevisionDto,
    actor: SessionActor,
  ) {
    if (await this.routeClient.isRoute(id))
      return this.routeClient.coordinateRevision(id, actor);
    return this.clientLifecycle.route(id, input, actor);
  }
  requestReconsideration(
    id: string,
    input: { note?: string },
    actor: SessionActor,
  ) {
    return this.routeClient.requestReconsideration(id, input.note, actor);
  }
  decideReconsideration(
    id: string,
    input: { decision: 'ACCEPT' | 'DENY'; note?: string },
    actor: SessionActor,
  ) {
    return this.routeClient.decideReconsideration(
      id,
      input.decision,
      input.note,
      actor,
    );
  }
  route(id: string, actor: SessionActor) {
    if (this.communications)
      return this.communications.routeProjection(id, actor);
    if (!actor.member?.id) throw routeForbidden();
    return this.repository.routeProjection(id, actor.member.id);
  }
  async forwardRoute(id: string, stepId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    if (!actor.member?.id && !admin) throw routeForbidden();
    if (!admin && actor.role.customScope !== 'division') throw routeForbidden();
    try {
      return await this.repository.forwardRoute(
        id,
        stepId,
        actor.id,
        actor.member?.id ?? null,
        admin,
      );
    } catch (error) {
      throw mapRouteError(error);
    }
  }
  async amendRoute(id: string, input: AmendWorkRequestRouteDto, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    if (!actor.member?.id && !admin) throw routeForbidden();
    if (
      !admin &&
      actor.role.customScope !== 'company' &&
      actor.role.customScope !== 'division'
    )
      throw routeForbidden();
    try {
      return await this.repository.amendRoute(
        id,
        input,
        actor.id,
        actor.member?.id ?? null,
        admin,
      );
    } catch (error) {
      throw mapRouteError(error);
    }
  }
}

function routeForbidden(): AppException {
  return new AppException({
    code: AppErrorCode.Forbidden,
    status: HttpStatus.FORBIDDEN,
    message: 'An active related Member profile is required for this route action.',
  });
}

function mapRouteError(error: unknown): AppException {
  if (error instanceof AppException) return error;
  const code = error instanceof Error ? error.message : '';
  if (code === 'WR_ROUTE_DIVISION_LEAD') return routeForbidden();
  const message = (
    {
      WR_ROUTE_POSITION: 'Work Request route position is no longer active.',
      WR_DIVISION_CYCLE_INCOMPLETE:
        'The current Division cycle must finish before forwarding the route.',
      WR_ROUTE_COMPLETE: 'Work Request route has no next step.',
      WR_ROUTE_CLIENT_GATEWAY:
        'The Client step can only be entered by submitting the final package.',
      WR_ROUTE_STALE:
        'Work Request route amendment is based on a stale route version.',
      WR_ROUTE_DIVISION:
        'A route amendment references an inactive or unavailable Division.',
    } satisfies Record<string, string>
  )[code] ?? 'Work Request route action could not be completed.';
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
