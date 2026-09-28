import { HttpStatus, Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { WorkRequestWorkflowNoteDto } from '../dtos/work-request.dto';
import {
  WorkRequestWorkflowRepository,
  type WorkRequestWorkflowSnapshot,
} from '../repositories/work-request-workflow.repository';

const rules: Record<
  WorkflowActionCode,
  { from: State; to: State; event: string; responsibility: Level }
> = {
  [WorkflowActionCode.WR_SUBMIT]: {
    from: State.MEMBER_ASSIGNED,
    to: State.MEMBER_SUBMITTED,
    event: 'WORK_SUBMITTED',
    responsibility: Level.MEMBER,
  },
  [WorkflowActionCode.WR_TEAM_LEAD_APPROVE]: {
    from: State.MEMBER_SUBMITTED,
    to: State.TEAM_LEAD_APPROVED,
    event: 'TEAM_LEAD_APPROVED',
    responsibility: Level.TEAM,
  },
  [WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION]: {
    from: State.MEMBER_SUBMITTED,
    to: State.MEMBER_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.TEAM,
  },
  [WorkflowActionCode.WR_DIVISION_LEAD_APPROVE]: {
    from: State.TEAM_LEAD_APPROVED,
    to: State.DIVISION_LEAD_APPROVED,
    event: 'DIVISION_LEAD_APPROVED',
    responsibility: Level.DIVISION,
  },
  [WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION]: {
    from: State.TEAM_LEAD_APPROVED,
    to: State.TEAM_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.DIVISION,
  },
  [WorkflowActionCode.WR_DIVISION_HEAD_APPROVE]: {
    from: State.DIVISION_LEAD_APPROVED,
    to: State.DIVISION_HEAD_APPROVED,
    event: 'DIVISION_HEAD_APPROVED',
    responsibility: Level.DIVISION,
  },
  [WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION]: {
    from: State.DIVISION_LEAD_APPROVED,
    to: State.DIVISION_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.DIVISION,
  },
} as Record<
  WorkflowActionCode,
  { from: State; to: State; event: string; responsibility: Level }
>;

@Injectable()
export class WorkRequestWorkflowProvider {
  constructor(
    private readonly repository: WorkRequestWorkflowRepository,
    private readonly uow: UnitOfWorkService,
    private readonly scopes: ObjectScopeProvider,
  ) {}

  submit(id: string, input: WorkRequestWorkflowNoteDto, actor: SessionActor) {
    return this.apply(id, WorkflowActionCode.WR_SUBMIT, input.note, actor);
  }

  async action(
    id: string,
    actionId: string | undefined,
    actionCode: WorkflowActionCode | undefined,
    note: string | undefined,
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        const resolved = actionCode
          ? { code: actionCode }
          : actionId
            ? await this.repository.actionCode(actionId)
            : null;
        if (!resolved || !isPhaseThreeAction(resolved.code))
          throw notFound('Workflow Action was not found.');
        return this.apply(id, resolved.code, note, actor);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async apply(
    id: string,
    action: WorkflowActionCode,
    note: string | undefined,
    actor: SessionActor,
  ) {
    const rule = rules[action];
    if (!rule) throw forbidden();
    return this.uow.execute(
      async () => {
        const snapshot = await this.repository.prepare(id);
        if (!snapshot) throw notFound('Work Request was not found.');
        if (snapshot.state !== rule.from)
          throw conflict('Work Request is not in a valid workflow state.');
        this.assertAuthorized(actor, action, rule.responsibility, snapshot);
        return this.repository.append({
          workRequestId: id,
          actorId: actor.id,
          action: rule.event,
          priorState: rule.from,
          resultingState: rule.to,
          note,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private assertAuthorized(
    actor: SessionActor,
    action: WorkflowActionCode,
    responsibility: Level,
    snapshot: WorkRequestWorkflowSnapshot,
  ) {
    if (
      actor.role.userRolesByRoleId.length !== 1 ||
      !actor.role.workflowActionRolePermissionsByRoleId.some(
        ({ action: grant }) => grant.code === action,
      )
    )
      throw forbidden();
    const member = actor.member;
    if (
      !snapshot.parent?.companyId ||
      !member?.isActive ||
      !member.company.isActive ||
      member.companyId !== snapshot.parent.companyId
    )
      throw forbidden();
    const assigned = snapshot.active[responsibility];
    if (!assigned)
      throw conflict('Work Request has no active required assignment.');
    if (responsibility === Level.MEMBER && member.id !== assigned)
      throw forbidden();
    const scope = this.scopes.resolve(actor);
    if (!scope.isSystemRole && scope.customScope === 'team') {
      const teamId = snapshot.active[Level.TEAM];
      if (
        !scope.boundTeamId ||
        scope.boundTeamId !== actor.boundTeamId ||
        teamId !== scope.boundTeamId
      )
        throw forbidden();
      return;
    }
    if (
      responsibility === Level.TEAM &&
      snapshot.teamLeadMemberId !== member.id
    )
      throw forbidden();
    this.scopes.assertCanAccess(actor, {
      allOf: [
        { kind: 'memberCompany', companyId: snapshot.parent.companyId },
        ...(responsibility === Level.MEMBER
          ? [{ kind: 'member', memberId: assigned } as const]
          : [
              {
                kind: 'memberDivision',
                divisionId: snapshot.active[Level.DIVISION]!,
              } as const,
            ]),
      ],
      allowTenantAdmin: false,
    });
  }
}

function isPhaseThreeAction(
  action: WorkflowActionCode,
): action is keyof typeof rules {
  return action in rules;
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
