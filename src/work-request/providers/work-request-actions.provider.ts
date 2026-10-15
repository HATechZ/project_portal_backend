import { Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import type { WorkRequestRecord } from '../repositories/work-request.records';
import {
  assignmentTransitionFor,
  reviewTransitionFor,
} from './work-request-transition.definitions';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';
@Injectable()
export class WorkRequestActionsProvider {
  available(
    actor: SessionActor,
    state: WorkRequestV1StateCode | null,
    record?: WorkRequestRecord,
  ) {
    const grants = new Set(
      actor.role.rolePermissions
        .filter(
          ({ revokedAt, permission }) =>
            revokedAt === null &&
            (actor.role.customScope === null ||
              permission.scopeCompatibilities?.some(
                ({ scope }) => scope === actor.role.customScope,
              )),
        )
        .map(({ permission }) => permission.code),
    );
    const hasActionPermission = (action: WorkflowActionCode) => {
      try {
        return grants.has(getFinalPermissionForWorkRequestAction(action));
      } catch {
        return false;
      }
    };
    if (!record) return [];
    const parent = record.bid ?? record.directProject;
    const member = actor.member;
    if (
      !parent ||
      !member?.isActive ||
      !member.company.isActive ||
      member.companyId !== parent.client.companyId
    )
      return [];
    const active = Object.fromEntries(
      record.assignments.map((assignment) => [
        assignment.level,
        assignment.divisionId ?? assignment.teamId ?? assignment.memberId,
      ]),
    );
    const canDivision = hasActionPermission(
      WorkflowActionCode.WR_ASSIGN_DIVISION,
    );
    const canTeam =
      hasActionPermission(WorkflowActionCode.WR_ASSIGN_TEAM) &&
      active.DIVISION !== undefined;
    const canMember =
      hasActionPermission(WorkflowActionCode.WR_ASSIGN_MEMBER) &&
      active.TEAM !== undefined;
    const actions = [] as {
      code: WorkflowActionCode;
      label: string;
      targetKind: string;
    }[];
    if (
      canDivision &&
      assignmentTransitionFor('DIVISION', state, active.DIVISION !== undefined)
    )
      actions.push({
        code: WorkflowActionCode.WR_ASSIGN_DIVISION,
        label: 'Assign Division',
        targetKind: 'division',
      });
    if (
      canTeam &&
      assignmentTransitionFor('TEAM', state, active.TEAM !== undefined)
    )
      actions.push({
        code: WorkflowActionCode.WR_ASSIGN_TEAM,
        label: 'Assign Team',
        targetKind: 'team',
      });
    if (
      canMember &&
      assignmentTransitionFor('MEMBER', state, active.MEMBER !== undefined)
    )
      actions.push({
        code: WorkflowActionCode.WR_ASSIGN_MEMBER,
        label: 'Assign Member',
        targetKind: 'member',
      });
    const canInfoScope = Object.values(active).includes(member.id);
    for (const code of [
      WorkflowActionCode.WR_SUBMIT,
      WorkflowActionCode.WR_CHECKING_APPROVE,
      WorkflowActionCode.WR_APPROVAL_APPROVE,
      WorkflowActionCode.WR_REQUEST_REVISION,
      WorkflowActionCode.WR_FINAL_RELEASE,
    ]) {
      const transition = reviewTransitionFor(code, state);
      if (
        transition &&
        active[transition.responsibility] === member.id &&
        hasActionPermission(code)
      )
        actions.push({
          code,
          label: transition.label,
          targetKind: transition.targetKind,
        });
    }
    if (
      state &&
      canInfoScope &&
      hasActionPermission(WorkflowActionCode.REQUEST_WORKFLOW_INFO)
    )
      actions.push({
        code: WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        label: 'Request Information',
        targetKind: 'info-request',
      });
    if (
      state &&
      canInfoScope &&
      hasActionPermission(WorkflowActionCode.RESPOND_WORKFLOW_INFO) &&
      record.infoRequests?.some((request) => request.targetActorId === actor.id)
    )
      actions.push({
        code: WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        label: 'Respond to Information Request',
        targetKind: 'info-response',
      });
    return actions;
  }
}
