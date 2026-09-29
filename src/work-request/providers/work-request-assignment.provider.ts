import { HttpStatus, Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode,
} from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  AssignDivisionDto,
  AssignMemberDto,
  AssignTeamDto,
} from '../dtos/work-request.dto';
import { WorkRequestAssignmentRepository } from '../repositories/work-request-assignment.repository';
import type { WorkRequestAssignmentSnapshot } from '../repositories/work-request-assignment.records';
import { WorkRequestResourceScopeProvider } from './work-request-resource-scope.provider';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';
import { WorkRequestAssignmentReadRepository } from '../repositories/work-request-assignment-read.repository';
import {
  assignmentTransitionFor,
  workRequestTransitionRequestMetadata,
} from './work-request-transition.definitions';

@Injectable()
export class WorkRequestAssignmentProvider {
  constructor(
    private readonly repository: WorkRequestAssignmentRepository,
    private readonly uow: UnitOfWorkService,
    private readonly resourceScope: WorkRequestResourceScopeProvider,
    private readonly scopes: ObjectScopeProvider,
    private readonly reads: WorkRequestReadRepository,
    private readonly historyReads: WorkRequestAssignmentReadRepository,
    private readonly outbox: OutboxService,
  ) {}

  division(id: string, input: AssignDivisionDto, actor: SessionActor) {
    return this.assign(id, input.divisionId, input.note, actor, 'DIVISION');
  }

  team(id: string, input: AssignTeamDto, actor: SessionActor) {
    return this.assign(id, input.teamId, input.note, actor, 'TEAM');
  }

  member(id: string, input: AssignMemberDto, actor: SessionActor) {
    return this.assign(id, input.memberId, input.note, actor, 'MEMBER');
  }

  async history(id: string, actor: SessionActor) {
    return this.uow.execute(async () => {
      const record = await this.reads.find(id);
      if (!record) throw notFound('Work Request was not found.');
      this.resourceScope.assert(actor, this.reads.parentScope(record));
      return this.historyReads.history(id);
    });
  }

  private async assign(
    workRequestId: string,
    targetId: string,
    note: string | undefined,
    actor: SessionActor,
    level: WorkRequestV1AssignmentLevelCode,
  ) {
    return this.uow.execute(
      async () => {
        const metadata = workRequestTransitionRequestMetadata();
        if (
          metadata.idempotencyKey &&
          (await this.repository.findByIdempotencyKey(metadata.idempotencyKey))
        )
          throw conflict('This assignment request has already been applied.');
        const snapshot = await this.repository.prepare(
          workRequestId,
          level,
          targetId,
          actor.boundTeamId,
        );
        if (!snapshot) throw notFound('Work Request was not found.');
        if (!snapshot.target)
          throw notFound('Assignment target was not found or is inactive.');
        if (snapshot.active[level] === targetId)
          throw conflict('Work Request is already assigned to this target.');
        const transition = assignmentTransitionFor(
          level,
          snapshot.state,
          !!snapshot.active[level],
        );
        if (!transition)
          throw conflict('Work Request is not in a valid assignment state.');
        this.assertHierarchy(snapshot, level);
        this.assertAuthorized(actor, snapshot, level);
        const written = await this.repository.write({
          workRequestId,
          level,
          targetId,
          actorId: actor.id,
          note,
          ...transition,
          ...metadata,
        });
        await this.outbox.enqueue(
          new WorkRequestTransitioned(
            {
              tenantId: RequestContext.requireTenantId(),
              actorId: actor.id,
              eventId: written.event.id,
              occurredAt: written.event.occurredAt.toISOString(),
              correlationId: metadata.correlationId,
            },
            {
              workRequestId,
              action: written.event.action,
              priorState: transition.priorState,
              resultingState: transition.resultingState,
            },
          ),
        );
        return {
          id: written.id,
          level: written.level,
          divisionId: written.divisionId,
          teamId: written.teamId,
          memberId: written.memberId,
          assignedAt: written.assignedAt,
          currentState: written.currentState,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private assertHierarchy(
    snapshot: WorkRequestAssignmentSnapshot,
    level: WorkRequestV1AssignmentLevelCode,
  ) {
    const divisionId =
      snapshot.active[WorkRequestV1AssignmentLevelCode.DIVISION];
    if (
      level !== WorkRequestV1AssignmentLevelCode.DIVISION &&
      (!divisionId || snapshot.target!.divisionId !== divisionId)
    )
      throw conflict('Assignment target is outside the assigned Division.');
    if (
      level === WorkRequestV1AssignmentLevelCode.MEMBER &&
      !snapshot.active[WorkRequestV1AssignmentLevelCode.TEAM]
    )
      throw conflict('Work Request has no active Team assignment.');
  }

  private assertAuthorized(
    actor: SessionActor,
    snapshot: WorkRequestAssignmentSnapshot,
    level: WorkRequestV1AssignmentLevelCode,
  ) {
    const permission = permissionFor(level);
    if (
      actor.role.userRolesByRoleId.length !== 1 ||
      !actor.role.workflowActionRolePermissionsByRoleId.some(
        ({ action }) => action.code === permission,
      )
    )
      throw forbidden();
    if (
      !snapshot.parentCompanyId ||
      snapshot.target!.companyId !== snapshot.parentCompanyId
    )
      throw conflict(
        'Assignment target is outside the Work Request organization.',
      );
    const scope = this.scopes.resolve(actor);
    if (!scope.isSystemRole && scope.customScope === 'team') {
      if (
        !scope.boundTeamId ||
        !actor.boundTeamId ||
        scope.boundTeamId !== actor.boundTeamId ||
        !snapshot.boundTeam
      )
        throw forbidden();
      const expectedTeam =
        level === WorkRequestV1AssignmentLevelCode.DIVISION
          ? snapshot.boundTeam.divisionId === snapshot.target!.divisionId
          : snapshot.boundTeam.id === snapshot.target!.teamId;
      if (!expectedTeam) throw forbidden();
      return;
    }
    const activeTeamId =
      snapshot.active[WorkRequestV1AssignmentLevelCode.TEAM] ?? null;
    this.resourceScope.assert(actor, {
      clientId: '',
      companyId: snapshot.parentCompanyId,
      divisionId:
        snapshot.active[WorkRequestV1AssignmentLevelCode.DIVISION] ??
        snapshot.target!.divisionId,
      teamId: activeTeamId,
    });
    const allOf = [
      { kind: 'memberCompany' as const, companyId: snapshot.target!.companyId },
      ...(scope.customScope === 'company'
        ? []
        : [
            {
              kind: 'memberDivision' as const,
              divisionId: snapshot.target!.divisionId,
            },
          ]),
    ];
    this.scopes.assertCanAccess(actor, {
      allOf,
      allowTenantAdmin: false,
    });
  }
}

function permissionFor(level: WorkRequestV1AssignmentLevelCode) {
  return {
    DIVISION: WorkflowActionCode.WR_ASSIGN_DIVISION,
    TEAM: WorkflowActionCode.WR_ASSIGN_TEAM,
    MEMBER: WorkflowActionCode.WR_ASSIGN_MEMBER,
  }[level];
}
function notFound(message: string) {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
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
function conflict(message: string) {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
