import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PermissionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { workRequestTransitionRequestMetadata } from './work-request-transition.definitions';
import { WorkRequestClientSubmissionRepository } from '../repositories/work-request-client-submission.repository';
import { requiredCapabilities } from './work-request-assignment.provider';

@Injectable()
export class WorkRequestClientSubmissionProvider {
  constructor(
    private readonly repository: WorkRequestClientSubmissionRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
  ) {}
  submit(
    id: string,
    input: { documentVersionIds: string[]; note?: string },
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        const meta = workRequestTransitionRequestMetadata();
        if (
          meta.idempotencyKey &&
          (await this.repository.findEventByIdempotencyKey(meta.idempotencyKey))
        )
          throw conflict('This workflow request has already been applied.');
        const snapshot = await this.repository.prepare(id);
        if (!snapshot) throw notFound();
        const resubmission =
          snapshot.clientSubmissions[0]?.decision?.decision ===
          'REQUEST_REVISION';
        if (snapshot.events[0]?.resultingState !== State.FINAL_RELEASE)
          throw conflict('Work Request is not in FINAL_RELEASE.');
        internal(
          actor,
          snapshot,
          PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW,
          Level.EXTERNAL_REVIEW,
        );
        if (resubmission && !has(actor, PermissionCode.SUBMIT_CLIENT_REVISION))
          throw forbidden();
        if (!input.documentVersionIds.length)
          throw bad('Select at least one document version.');
        const versions = await this.repository.versions(
          id,
          input.documentVersionIds,
        );
        if (versions.length !== new Set(input.documentVersionIds).size)
          throw bad(
            'A selected document version is invalid for this Work Request.',
          );
        const written = await this.repository.createSubmission({
          workRequestId: id,
          actorId: actor.id,
          versionIds: input.documentVersionIds,
          note: input.note,
          resubmission,
          ...meta,
        });
        await this.publish(id, actor.id, written.event, meta.correlationId);
        return submissionResponse(written.submission);
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async decide(
    id: string,
    submissionId: string,
    input: {
      decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION';
      note?: string;
    },
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        const meta = workRequestTransitionRequestMetadata();
        if (
          meta.idempotencyKey &&
          (await this.repository.findEventByIdempotencyKey(meta.idempotencyKey))
        )
          throw conflict('This workflow request has already been applied.');
        const snapshot = await this.repository.prepare(id);
        if (
          !snapshot ||
          snapshot.events[0]?.resultingState !== State.CLIENT_REVIEW
        )
          throw conflict('Work Request is not in CLIENT_REVIEW.');
        const submission = snapshot.clientSubmissions[0];
        if (
          !submission ||
          submission.id !== submissionId ||
          submission.decision
        )
          throw conflict('Submission is stale or already decided.');
        external(actor, snapshot);
        const permission =
          input.decision === 'ACCEPT'
            ? PermissionCode.ACCEPT_FINAL_DELIVERY
            : input.decision === 'REJECT'
              ? PermissionCode.REJECT_FINAL_DELIVERY
              : PermissionCode.REQUEST_REVISION;
        if (!has(actor, permission)) throw forbidden();
        if (input.decision === 'REQUEST_REVISION' && !input.note)
          throw bad('A revision reason is required.');
        const written = await this.repository.decide({
          workRequestId: id,
          submissionId,
          actorId: actor.id,
          decision: input.decision,
          note: input.note,
          ...meta,
        });
        await this.publish(id, actor.id, written.event, meta.correlationId);
        return {
          id: written.decision.id,
          decision: written.decision.decision,
          decidedAt: written.decision.decidedAt,
          currentState: written.state,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  route(
    id: string,
    input: {
      destination: 'MEMBER' | 'CHECKING' | 'APPROVAL' | 'FINAL_REVIEW';
      note?: string;
    },
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        const meta = workRequestTransitionRequestMetadata();
        if (
          meta.idempotencyKey &&
          (await this.repository.findEventByIdempotencyKey(meta.idempotencyKey))
        )
          throw conflict('This workflow request has already been applied.');
        const snapshot = await this.repository.prepare(id);
        if (
          !snapshot ||
          snapshot.events[0]?.resultingState !== State.CLIENT_REVISION_REQUESTED
        )
          throw conflict(
            'Work Request is not awaiting client revision routing.',
          );
        internal(
          actor,
          snapshot,
          PermissionCode.ROUTE_FOR_REVIEW,
          Level.EXTERNAL_REVIEW,
        );
        const submission = snapshot.clientSubmissions[0];
        if (
          !submission?.decision ||
          submission.decision.decision !== 'REQUEST_REVISION'
        )
          throw conflict('Client revision context is invalid.');
        const destination = snapshot.assignments.find(
          (a) => a.level === input.destination && a.memberId,
        );
        if (!destination?.memberId)
          throw conflict('Destination responsibility has no active assignee.');
        const capabilities = await this.repository.memberCapabilities(
          destination.memberId,
        );
        const missing = requiredCapabilities(input.destination as Level).filter(
          (permission) => !capabilities.includes(permission),
        );
        if (missing.length)
          throw conflict(
            `Destination assignee lacks required capabilities: ${missing.join(', ')}.`,
          );
        const event = await this.repository.route({
          workRequestId: id,
          actorId: actor.id,
          destination: input.destination,
          clientSubmissionId: submission.id,
          clientDecisionId: submission.decision.id,
          note: input.note,
          ...meta,
        });
        await this.publish(id, actor.id, event, meta.correlationId);
        return {
          eventId: event.id,
          destination: input.destination,
          currentState: event.resultingState,
          occurredAt: event.occurredAt,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  list(id: string, actor: SessionActor) {
    return this.uow.execute(async () => {
      const snapshot = await this.repository.prepare(id);
      if (!snapshot) throw notFound();
      if (actor.clientContact) external(actor, snapshot);
      else if (!actor.member || !has(actor, PermissionCode.VIEW_WORK_REQUEST))
        throw forbidden();
      return (await this.repository.list(id)).map(submissionResponse);
    });
  }
  private async publish(
    id: string,
    actorId: string,
    event: {
      id: string;
      action: string;
      priorState: State | null;
      resultingState: State | null;
      occurredAt: Date;
    },
    correlationId: string | undefined,
  ) {
    await this.outbox.enqueue(
      new WorkRequestTransitioned(
        {
          tenantId: RequestContext.requireTenantId(),
          actorId,
          eventId: event.id,
          occurredAt: event.occurredAt.toISOString(),
          correlationId,
        },
        {
          workRequestId: id,
          action: event.action,
          priorState: event.priorState ?? '',
          resultingState: event.resultingState ?? '',
        },
      ),
    );
  }
}
function submissionResponse(submission: any) {
  return {
    id: submission.id,
    submissionNumber: submission.submissionNumber,
    submittedAt: submission.submittedAt,
    documentVersionIds: submission.items.map(
      (item: any) => item.documentVersionId,
    ),
    decision: submission.decision
      ? {
          id: submission.decision.id,
          decision: submission.decision.decision,
          decidedAt: submission.decision.decidedAt,
        }
      : null,
  };
}
function has(actor: SessionActor, permission: PermissionCode) {
  return actor.role.rolePermissions.some(
    ({ revokedAt, permission: grant }) =>
      revokedAt === null &&
      grant.code === permission &&
      (actor.role.customScope === null ||
        grant.scopeCompatibilities.some(
          ({ scope }) => scope === actor.role.customScope,
        )),
  );
}
function internal(
  actor: SessionActor,
  snapshot: any,
  permission: PermissionCode,
  responsibility: Level,
) {
  const parent = snapshot.bid ?? snapshot.directProject;
  if (hasTenantWideInternalAuthority(actor)) {
    if (!parent?.client.companyId || !has(actor, permission)) throw forbidden();
    return;
  }
  if (
    !actor.member?.isActive ||
    !actor.member.company.isActive ||
    actor.member.companyId !== parent?.client.companyId ||
    snapshot.assignments.find((a: any) => a.level === responsibility)
      ?.memberId !== actor.member.id ||
    !has(actor, permission)
  )
    throw forbidden();
}
function external(actor: SessionActor, snapshot: any) {
  const parent = snapshot.bid ?? snapshot.directProject;
  if (
    (actor.role.customScope !== 'client' &&
      actor.role.customScope !== 'client_contact') ||
    !actor.clientContact?.isActive ||
    !actor.clientContact.client.isActive ||
    actor.clientContact.clientId !== parent?.clientId
  )
    throw forbidden();
}
function bad(message: string) {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function conflict(message: string) {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
function forbidden() {
  return new AppException({
    code: AppErrorCode.Forbidden,
    status: HttpStatus.FORBIDDEN,
    message: "You don't have permission to perform this action.",
  });
}
function notFound() {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: 'Work Request was not found.',
  });
}
