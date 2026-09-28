import { HttpStatus, Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';
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

@Injectable()
export class WorkRequestAssignmentProvider {
  constructor(
    private readonly repository: WorkRequestAssignmentRepository,
    private readonly uow: UnitOfWorkService,
    private readonly resourceScope: WorkRequestResourceScopeProvider,
    private readonly scopes: ObjectScopeProvider,
    private readonly reads: WorkRequestReadRepository,
    private readonly historyReads: WorkRequestAssignmentReadRepository,
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
        const snapshot = await this.repository.prepare(
          workRequestId,
          level,
          targetId,
          actor.boundTeamId,
        );
        if (!snapshot) throw notFound('Work Request was not found.');
        if (!snapshot.target)
          throw notFound('Assignment target was not found or is inactive.');
        const transition = transitionFor(
          level,
          snapshot.state,
          !!snapshot.active[level],
        );
        this.assertHierarchy(snapshot, level);
        this.assertAuthorized(actor, snapshot, level);
        return this.repository.write({
          workRequestId,
          level,
          targetId,
          actorId: actor.id,
          note,
          ...transition,
        });
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

function transitionFor(
  level: WorkRequestV1AssignmentLevelCode,
  state: WorkRequestV1StateCode | null,
  replacing: boolean,
) {
  const rule = {
    [WorkRequestV1AssignmentLevelCode.DIVISION]: {
      initial: WorkRequestV1StateCode.CREATED,
      assigned: WorkRequestV1StateCode.DIVISION_ASSIGNED,
      assign: 'DIVISION_ASSIGNED',
      reassign: 'DIVISION_REASSIGNED',
    },
    [WorkRequestV1AssignmentLevelCode.TEAM]: {
      initial: WorkRequestV1StateCode.DIVISION_ASSIGNED,
      assigned: WorkRequestV1StateCode.TEAM_ASSIGNED,
      assign: 'TEAM_ASSIGNED',
      reassign: 'TEAM_REASSIGNED',
    },
    [WorkRequestV1AssignmentLevelCode.MEMBER]: {
      initial: WorkRequestV1StateCode.TEAM_ASSIGNED,
      assigned: WorkRequestV1StateCode.MEMBER_ASSIGNED,
      assign: 'MEMBER_ASSIGNED',
      reassign: 'MEMBER_REASSIGNED',
    },
  }[level];
  if (state !== (replacing ? rule.assigned : rule.initial))
    throw conflict('Work Request is not in a valid assignment state.');
  return {
    priorState: state as WorkRequestV1StateCode,
    resultingState: rule.assigned,
    action: replacing ? rule.reassign : rule.assign,
    replacing,
  };
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
