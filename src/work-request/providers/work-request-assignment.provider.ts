import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PermissionCode,
  WorkRequestV1AssignmentLevelCode,
} from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import type { SessionActor } from '../../common/security/session.types';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  AssignDivisionDto,
  AssignMemberDto,
  AssignReviewerDto,
  AssignTeamDto,
  WorkRequestAssignmentHistoryResponseDto,
} from '../dtos/work-request.dto';
import { WorkRequestAssignmentRepository } from '../repositories/work-request-assignment.repository';
import type { WorkRequestAssignmentSnapshot } from '../repositories/work-request-assignment.records';
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

  reviewer(id: string, input: AssignReviewerDto, actor: SessionActor) {
    return this.assign(id, input.memberId, input.note, actor, input.level);
  }

  async history(
    id: string,
    _actor: SessionActor,
  ): Promise<WorkRequestAssignmentHistoryResponseDto[]> {
    void _actor;
    return this.uow.execute(async () => {
      const record = await this.reads.find(id, _actor);
      if (!record) throw notFound('Work Request was not found.');
      return (await this.historyReads.history(id)).map((assignment) => ({
        id: assignment.id,
        level: assignment.level,
        divisionId: assignment.divisionId,
        teamId: assignment.teamId,
        memberId: assignment.memberId,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        replacedAt: assignment.replacedAt,
        note: assignment.note,
        assignedBy: assignment.assignedByActor,
      }));
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
        this.assertTargetCapabilities(snapshot, level);
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

  private assertAuthorized(
    actor: SessionActor,
    snapshot: WorkRequestAssignmentSnapshot,
    level: WorkRequestV1AssignmentLevelCode,
  ) {
    const permission = permissionFor(level);
    if (
      !actor.role.rolePermissions.some(
        ({ revokedAt, permission: grant }) =>
          revokedAt === null &&
          grant.code === permission &&
          (actor.role.customScope === null ||
            grant.scopeCompatibilities.some(
              ({ scope }) => scope === actor.role.customScope,
            )),
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
    const member = actor.member;
    if (!member?.isActive || !member.company.isActive) throw forbidden();
  }

  private assertTargetCapabilities(
    snapshot: WorkRequestAssignmentSnapshot,
    level: WorkRequestV1AssignmentLevelCode,
  ) {
    const required = requiredCapabilities(level);
    if (!required.length) return;
    const missing = required.filter(
      (permission) =>
        !(snapshot.target!.permissionCodes ?? required).includes(permission),
    );
    if (missing.length)
      throw conflict(
        `Assignment target lacks required capabilities: ${missing.join(', ')}.`,
      );
  }
}

function permissionFor(level: WorkRequestV1AssignmentLevelCode) {
  if (
    level === WorkRequestV1AssignmentLevelCode.CHECKING ||
    level === WorkRequestV1AssignmentLevelCode.APPROVAL ||
    level === WorkRequestV1AssignmentLevelCode.FINAL_REVIEW ||
    level === WorkRequestV1AssignmentLevelCode.EXTERNAL_REVIEW
  )
    return PermissionCode.ASSIGN_REVIEWER;
  return {
    DIVISION: PermissionCode.ASSIGN_WORK_REQUEST_DIVISION,
    TEAM: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
    MEMBER: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  }[level];
}

export function requiredCapabilities(level: WorkRequestV1AssignmentLevelCode) {
  const common = [PermissionCode.VIEW_WORK_REQUEST, PermissionCode.VIEW_DOCUMENT];
  if (level === WorkRequestV1AssignmentLevelCode.MEMBER)
    return [...common, PermissionCode.SUBMIT_WORK_REQUEST];
  if (
    level === WorkRequestV1AssignmentLevelCode.CHECKING ||
    level === WorkRequestV1AssignmentLevelCode.APPROVAL
  )
    return [
      ...common,
      PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
      PermissionCode.REQUEST_WORK_REQUEST_REVISION,
    ];
  if (level === WorkRequestV1AssignmentLevelCode.FINAL_REVIEW)
    return [
      ...common,
      PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      PermissionCode.SUBMIT_FOR_REVIEW,
    ];
  if (level === WorkRequestV1AssignmentLevelCode.EXTERNAL_REVIEW)
    return [
      ...common,
      PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW,
      PermissionCode.SUBMIT_CLIENT_REVISION,
    ];
  return [];
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
