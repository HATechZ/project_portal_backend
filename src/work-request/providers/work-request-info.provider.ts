import { HttpStatus, Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { SessionActor } from '../../common/security/session.types';
import { hasCompanyWorkRequestScope } from '../../common/security/work-request-visibility';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
} from '../dtos/work-request.dto';
import { WorkRequestInfoRepository } from '../repositories/work-request-info.repository';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';
import { workRequestTransitionRequestMetadata } from './work-request-transition.definitions';

@Injectable()
export class WorkRequestInfoProvider {
  constructor(
    private readonly repository: WorkRequestInfoRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
  ) {}

  request(
    id: string,
    input: CreateWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        this.assertPermission(actor, WorkflowActionCode.REQUEST_WORKFLOW_INFO);
        const snapshot = await this.repository.prepare(id, input.targetActorId);
        if (!snapshot?.parent || !snapshot.target) throw notFound();
        const state = snapshot.request.events[0]?.resultingState;
        if (!state)
          throw conflict('Work Request has no current workflow state.');
        if (state === 'ACCEPTED' || state === 'REJECTED')
          throw conflict('Work Request is no longer active.');
        // Administrative visibility does not create a communication identity.
        if (!actor.member?.id && !actor.clientContact?.id) throw forbidden();
        const recipients = await this.repository.eligibleRecipients(id, actor.id);
        if (!recipients?.some((recipient) => recipient.id === input.targetActorId))
          throw forbidden('The selected information recipient is not eligible.');
        if (input.parentInfoRequestId)
          await this.assertParent(id, input.parentInfoRequestId, actor.id);
        await this.assertAttachments(id, input.documentVersionIds);
        const metadata = workRequestTransitionRequestMetadata();
        try {
          const written = await this.repository.create({
            workRequestId: id,
            requestedByActorId: actor.id,
            targetActorId: input.targetActorId,
            message: input.message,
            stateAtRequest: state,
            parentInfoRequestId: input.parentInfoRequestId,
            documentVersionIds: input.documentVersionIds,
            ...metadata,
          });
          if (!written.duplicate)
            await this.publish(
              id,
              actor.id,
              input.targetActorId,
              'INFO_REQUESTED',
              state,
              written.request.id,
              written.request.requestedAt,
              metadata.correlationId,
            );
          return requestResponse(written.request);
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message === 'INFO_PARENT' ||
              error.message === 'INFO_PARENT_PARTICIPANT')
          )
            throw conflict(
              'Information Request parent is invalid or inaccessible.',
            );
          throw error;
        }
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async respond(
    id: string,
    infoRequestId: string,
    input: RespondWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        const snapshot = await this.repository.prepare(
          id,
          actor.id,
          infoRequestId,
        );
        if (
          !snapshot?.parent ||
          !snapshot.info ||
          !snapshot.target ||
          snapshot.info.targetActorId !== actor.id
        )
          throw notFound('Information Request was not found.');
        const state = snapshot.request.events[0]?.resultingState;
        if (!state || state === State.ACCEPTED || state === State.REJECTED)
          throw conflict('Work Request is no longer active.');
        await this.assertAttachments(id, input.documentVersionIds);
        const metadata = workRequestTransitionRequestMetadata();
        const result = await this.repository.respond(
          id,
          infoRequestId,
          actor.id,
          input.message,
          input.documentVersionIds,
          metadata.idempotencyKey,
          metadata.correlationId,
        );
        if (result.kind === 'missing')
          throw notFound('Information Request was not found.');
        if (result.kind === 'forbidden') throw forbidden();
        if (result.kind === 'closed')
          throw conflict('Information Request is already closed.');
        if (result.kind === 'ok')
          await this.publish(
            id,
            actor.id,
            snapshot.info.requestedByActorId,
            'INFO_RESPONDED',
            state,
            result.response.id,
            result.response.respondedAt,
            metadata.correlationId,
          );
        return responseResponse(result.response, actor);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async history(id: string, actor: SessionActor) {
    return this.uow.execute(async () => {
      const snapshot = await this.repository.prepare(id);
      if (!snapshot?.parent) throw notFound();
      const routeRecipient = actor.member?.id
        ? await this.repository.isActiveRouteLead(id, actor.member.id)
        : false;
      const administrativeRead = await this.canReadAsAdministrator(id, actor, snapshot);
      if (!administrativeRead) this.assertParticipant(actor, snapshot, routeRecipient);
      const routeOnly = routeRecipient && actor.member && !isInternalResponsible(
        actor.member.id, snapshot.request.assignments, snapshot.request.route,
      );
      return (
        await this.repository.history(
          id,
          isExternal(actor) || routeOnly ? actor.id : undefined,
        )
      ).map(requestResponse);
    });
  }

  async eligibleRecipients(id: string, actor: SessionActor) {
    return this.uow.execute(async () => {
      this.assertPermission(actor, WorkflowActionCode.REQUEST_WORKFLOW_INFO);
      const snapshot = await this.repository.prepare(id);
      if (!snapshot?.parent) throw notFound();
      const state = snapshot.request.events[0]?.resultingState;
      if (!state || state === State.ACCEPTED || state === State.REJECTED)
        throw conflict('Work Request is no longer active.');
      if (!actor.member?.id && !actor.clientContact?.id) return [];
      const recipients = await this.repository.eligibleRecipients(id, actor.id);
      if (!recipients) throw notFound();
      return recipients.map((recipient) => ({
        actorId: recipient.id,
        actorProfileId: recipient.id,
        label: recipient.label,
        displayName: recipient.member?.name ?? recipient.clientContact?.name ?? recipient.label,
        recipientType: recipient.memberId ? 'INTERNAL_MEMBER' as const : 'EXTERNAL_CLIENT_CONTACT' as const,
        contextType: recipient.memberId ? 'DIVISION_LEAD' as const : 'CLIENT_CONTACT' as const,
        canReceive: true,
        unavailableReason: null,
        // Selection means the actor has a usable portal profile.  The exact
        // addressed-request check, rather than a broad response grant, governs
        // whether this person can reply.
        canRespond: true,
        context: recipient.memberId
          ? { kind: 'DIVISION_LEAD' as const, ...recipient.member?.divisionLeadsByMemberId[0]?.division }
          : { kind: 'CLIENT_CONTACT' as const, ...recipient.clientContact?.client },
        contexts: recipient.memberId
          ? (recipient.member?.divisionLeadsByMemberId ?? []).map(({ division }) => ({ kind: 'DIVISION_LEAD' as const, ...division }))
          : recipient.clientContact ? [{ kind: 'CLIENT_CONTACT' as const, ...recipient.clientContact.client }] : [],
        type: recipient.memberId
          ? ('INTERNAL_MEMBER' as const)
          : ('EXTERNAL_CLIENT_CONTACT' as const),
      }));
    });
  }

  async recipientStatus(id: string, actor: SessionActor) {
    await this.eligibleRecipients(id, actor);
    return this.uow.execute(async () => {
      const status = await this.repository.clientRecipientStatus(id, actor.id);
      if (!status) throw notFound();
      return status;
    });
  }

  private async canReadAsAdministrator(id: string, actor: SessionActor, snapshot: any) {
    if (!actor.isActive || !actor.role.isActive || !hasCompanyWorkRequestScope(actor)) return false;
    if (actor.role.customScope === 'company' && (!actor.member?.isActive || !actor.member.company.isActive || actor.member.companyId !== snapshot.parent.client.companyId)) return false;
    return this.repository.isVisible(id, actor);
  }

  private assertPermission(actor: SessionActor, action: WorkflowActionCode) {
    const permission = getFinalPermissionForWorkRequestAction(action);
    if (
      !actor.role.rolePermissions.some(
        ({ revokedAt, permission: grant }) =>
          revokedAt === null &&
          grant.code === permission &&
          (actor.role.customScope === null ||
            grant.scopeCompatibilities?.some(
              ({ scope }) => scope === actor.role.customScope,
            )),
      )
    )
      throw forbidden();
  }

  private async assertParent(
    workRequestId: string,
    parentId: string,
    actorId: string,
  ) {
    const snapshot = await this.repository.prepare(
      workRequestId,
      undefined,
      parentId,
    );
    if (
      !snapshot?.info ||
      (snapshot.info.requestedByActorId !== actorId &&
        snapshot.info.targetActorId !== actorId)
    )
      throw conflict('Information Request parent is invalid or inaccessible.');
  }

  private async assertAttachments(workRequestId: string, ids?: string[]) {
    if (!ids?.length) return;
    if (
      ids.length !== new Set(ids).size ||
      !(await this.repository.hasDocumentVersions(workRequestId, ids))
    )
      throw conflict('An attachment version is invalid for this Work Request.');
  }

  private assertParticipant(
    actor: SessionActor,
    snapshot: any,
    routeRecipient = false,
  ) {
    if (!actor.isActive) throw forbidden();
    if (isExternal(actor)) {
      if (
        !actor.clientContact?.isActive ||
        !actor.clientContact.client.isActive ||
        actor.clientContact.clientId !== snapshot.parent.clientId
      )
        throw forbidden();
      return;
    }
    const member = actor.member;
    if (
      !member?.isActive ||
      !member.company.isActive ||
      member.companyId !== snapshot.parent.client.companyId ||
      !(routeRecipient || isInternalResponsible(
        member.id,
        snapshot.request.assignments,
        snapshot.request.route,
      ))
    )
      throw forbidden();
  }

  private async publish(
    workRequestId: string,
    actorId: string,
    recipientActorId: string,
    action: string,
    state: State,
    eventId: string,
    at: Date,
    correlationId?: string,
  ) {
    await this.outbox.enqueue(
      new WorkRequestTransitioned(
        {
          tenantId: RequestContext.requireTenantId(),
          actorId,
          eventId,
          occurredAt: at.toISOString(),
          correlationId,
        },
        {
          workRequestId,
          action,
          priorState: state,
          resultingState: state,
          recipientActorId,
        } as never,
      ),
    );
  }
}

function internalLevel(level: Level) {
  return (
    [
      Level.MEMBER,
      Level.CHECKING,
      Level.APPROVAL,
      Level.FINAL_REVIEW,
      Level.EXTERNAL_REVIEW,
    ] as Level[]
  ).includes(level);
}
function isInternalResponsible(
  memberId: string,
  assignments: any[],
  route?: {
    responsibleOriginatingLead?: {
      memberId: string;
      revokedAt: Date | null;
      member: { isActive: boolean };
      division: { isActive: boolean };
    } | null;
  } | null,
) {
  return (
    assignments.some(
      (assignment) =>
        (internalLevel(assignment.level) && assignment.memberId === memberId) ||
        (assignment.level === Level.DIVISION &&
          assignment.division?.divisionLeadsByDivisionId.some(
            (lead: { memberId: string }) => lead.memberId === memberId,
          )),
    ) ||
    (route?.responsibleOriginatingLead?.memberId === memberId &&
      route.responsibleOriginatingLead.revokedAt === null &&
      route.responsibleOriginatingLead.member.isActive &&
      route.responsibleOriginatingLead.division.isActive)
  );
}
function isExternal(actor: SessionActor) {
  return (
    actor.role.customScope === 'client' ||
    actor.role.customScope === 'client_contact'
  );
}
function participant(actor: any): {
  actorId: string;
  type: 'INTERNAL_MEMBER' | 'EXTERNAL_CLIENT_CONTACT';
} {
  return {
    actorId: actor.id,
    type: actor.clientContact ? 'EXTERNAL_CLIENT_CONTACT' : 'INTERNAL_MEMBER',
  };
}
function requestResponse(request: any) {
  return {
    id: request.id,
    parentInfoRequestId: request.parentInfoRequestId,
    requester: participant(request.requestedByActor),
    target: participant(request.targetActor),
    message: request.message,
    status: request.status,
    stateAtRequest: request.stateAtRequest,
    requestedAt: request.requestedAt,
    closedAt: request.closedAt,
    attachments: request.attachments.map((attachment: any) => ({
      documentVersionId: attachment.documentVersionId,
    })),
    responses: request.responses.map((response: any) =>
      responseResponse(response, response.respondedByActor),
    ),
  };
}
function responseResponse(response: any, responder: any) {
  return {
    id: response.id,
    responder: participant(responder),
    message: response.message,
    respondedAt: response.respondedAt,
    attachments: response.attachments.map((attachment: any) => ({
      documentVersionId: attachment.documentVersionId,
    })),
  };
}

function notFound(message = 'Work Request was not found.') {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
function forbidden(message = "You don't have permission to perform this action.") {
  return new AppException({
    code: AppErrorCode.Forbidden,
    status: HttpStatus.FORBIDDEN,
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
