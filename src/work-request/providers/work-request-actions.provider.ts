import { Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import type { WorkRequestRecord } from '../repositories/work-request.records';
import {
  assignmentTransitionFor,
  WORK_REQUEST_REVIEW_TRANSITIONS,
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
        .filter(({ revokedAt }) => revokedAt === null)
        .map(({ permission }) => permission.code),
    );
    const hasActionPermission = (action: WorkflowActionCode) => {
      try {
        return grants.has(getFinalPermissionForWorkRequestAction(action));
      } catch {
        return false;
      }
    };
    if (!record || actor.role.userRolesByRoleId.length !== 1) return [];
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
    const canDivision =
      hasActionPermission(
      WorkflowActionCode.WR_ASSIGN_DIVISION,
      ) &&
      (actor.role.customScope === 'company' ||
        actor.role.systemRole?.systemCode === 'tenant_super_admin');
    const canTeam =
      hasActionPermission(WorkflowActionCode.WR_ASSIGN_TEAM) &&
      active.DIVISION !== undefined &&
      member.divisionLeadsByMemberId.some(
        ({ divisionId }) => divisionId === active.DIVISION,
      );
    const canMember =
      hasActionPermission(WorkflowActionCode.WR_ASSIGN_MEMBER) &&
      record.assignments.some(
        (assignment) =>
          assignment.level === 'TEAM' &&
          assignment.team?.isActive === true &&
          assignment.team.leadMemberId === member.id,
      );
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
    const assignedMember = active.MEMBER === member.id;
    const teamAssignment = record.assignments.find(
      (assignment) => assignment.level === 'TEAM',
    );
    const canReviewTeam =
      teamAssignment?.team?.isActive === true &&
      teamAssignment.team.leadMemberId === member.id;
    const canReviewDivision =
      active.DIVISION !== undefined &&
      member.divisionLeadsByMemberId.some(
        ({ divisionId }) => divisionId === active.DIVISION,
      );
    const canInfoScope =
      actor.role.customScope === 'company' ||
      actor.role.systemRole?.systemCode === 'tenant_super_admin' ||
      record.assignments.some(
      (assignment) =>
        assignment.level === 'MEMBER'
          ? assignment.memberId === member.id
          : assignment.level === 'TEAM'
            ? assignment.team?.leadMemberId === member.id
            : member.divisionLeadsByMemberId.some(
                ({ divisionId }) => divisionId === assignment.divisionId,
              ),
      );
    for (const [code, transition] of Object.entries(
      WORK_REQUEST_REVIEW_TRANSITIONS,
    ) as [
      WorkflowActionCode,
      (typeof WORK_REQUEST_REVIEW_TRANSITIONS)[keyof typeof WORK_REQUEST_REVIEW_TRANSITIONS],
    ][]) {
      const authorized =
        transition.responsibility === 'MEMBER'
          ? assignedMember
          : transition.responsibility === 'TEAM'
            ? canReviewTeam
            : canReviewDivision;
      if (state === transition.from && authorized && hasActionPermission(code))
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
