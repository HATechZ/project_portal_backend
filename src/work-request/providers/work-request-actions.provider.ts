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
@Injectable()
export class WorkRequestActionsProvider {
  available(
    actor: SessionActor,
    state: WorkRequestV1StateCode | null,
    record?: WorkRequestRecord,
  ) {
    const grants = new Set(
      actor.role.workflowActionRolePermissionsByRoleId.map(
        ({ action }) => action.code,
      ),
    );
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
    const customTeam =
      !actor.role.isSystemRole && actor.role.customScope === 'team';
    const customDivision =
      !actor.role.isSystemRole && actor.role.customScope === 'division';
    const sameDivision = (divisionId: string | null | undefined) =>
      member.division.isActive &&
      (member.divisionId === divisionId ||
        member.divisionLeadsByMemberId.some(
          (lead) => lead.divisionId === divisionId,
        ));
    const canDivision =
      !customTeam &&
      member.division.isActive &&
      grants.has(WorkflowActionCode.WR_ASSIGN_DIVISION);
    const canTeam =
      !customTeam &&
      sameDivision(active.DIVISION) &&
      grants.has(WorkflowActionCode.WR_ASSIGN_TEAM);
    const canMember =
      (customTeam
        ? actor.boundTeamId === active.TEAM
        : sameDivision(active.DIVISION)) &&
      grants.has(WorkflowActionCode.WR_ASSIGN_MEMBER);
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
    const assignedTeam = active.TEAM;
    const teamAssignment = record.assignments.find(
      (assignment) => assignment.level === 'TEAM',
    );
    const canReviewTeam = customTeam
      ? actor.boundTeamId === assignedTeam && teamAssignment?.team?.isActive
      : teamAssignment?.team?.isActive === true &&
        teamAssignment.team.leadMemberId === member.id;
    const canReviewDivision = !customTeam && sameDivision(active.DIVISION);
    const canInfoScope = customTeam
      ? actor.boundTeamId === active.TEAM
      : customDivision
        ? !!active.DIVISION && sameDivision(active.DIVISION)
        : true;
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
      if (state === transition.from && authorized && grants.has(code))
        actions.push({
          code,
          label: transition.label,
          targetKind: transition.targetKind,
        });
    }
    if (
      state &&
      canInfoScope &&
      grants.has(WorkflowActionCode.REQUEST_WORKFLOW_INFO)
    )
      actions.push({
        code: WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        label: 'Request Information',
        targetKind: 'info-request',
      });
    if (
      state &&
      canInfoScope &&
      grants.has(WorkflowActionCode.RESPOND_WORKFLOW_INFO) &&
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
