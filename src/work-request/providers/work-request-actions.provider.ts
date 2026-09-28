import { Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import type { WorkRequestRecord } from '../repositories/work-request.records';
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
      (state === WorkRequestV1StateCode.CREATED ||
        state === WorkRequestV1StateCode.DIVISION_ASSIGNED)
    )
      actions.push({
        code: WorkflowActionCode.WR_ASSIGN_DIVISION,
        label: 'Assign Division',
        targetKind: 'division',
      });
    if (
      canTeam &&
      (state === WorkRequestV1StateCode.DIVISION_ASSIGNED ||
        state === WorkRequestV1StateCode.TEAM_ASSIGNED)
    )
      actions.push({
        code: WorkflowActionCode.WR_ASSIGN_TEAM,
        label: 'Assign Team',
        targetKind: 'team',
      });
    if (
      canMember &&
      (state === WorkRequestV1StateCode.TEAM_ASSIGNED ||
        state === WorkRequestV1StateCode.MEMBER_ASSIGNED)
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
    if (
      state === WorkRequestV1StateCode.MEMBER_ASSIGNED &&
      assignedMember &&
      grants.has(WorkflowActionCode.WR_SUBMIT)
    )
      actions.push({
        code: WorkflowActionCode.WR_SUBMIT,
        label: 'Submit Work Request',
        targetKind: 'submit',
      });
    if (state === WorkRequestV1StateCode.MEMBER_SUBMITTED && canReviewTeam) {
      if (grants.has(WorkflowActionCode.WR_TEAM_LEAD_APPROVE))
        actions.push({
          code: WorkflowActionCode.WR_TEAM_LEAD_APPROVE,
          label: 'Approve by Team Lead',
          targetKind: 'workflow',
        });
      if (grants.has(WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION))
        actions.push({
          code: WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION,
          label: 'Request Revision by Team Lead',
          targetKind: 'workflow',
        });
    }
    if (
      state === WorkRequestV1StateCode.TEAM_LEAD_APPROVED &&
      canReviewDivision
    ) {
      if (grants.has(WorkflowActionCode.WR_DIVISION_LEAD_APPROVE))
        actions.push({
          code: WorkflowActionCode.WR_DIVISION_LEAD_APPROVE,
          label: 'Approve by Division Lead',
          targetKind: 'workflow',
        });
      if (grants.has(WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION))
        actions.push({
          code: WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION,
          label: 'Request Revision by Division Lead',
          targetKind: 'workflow',
        });
    }
    if (
      state === WorkRequestV1StateCode.DIVISION_LEAD_APPROVED &&
      canReviewDivision
    ) {
      if (grants.has(WorkflowActionCode.WR_DIVISION_HEAD_APPROVE))
        actions.push({
          code: WorkflowActionCode.WR_DIVISION_HEAD_APPROVE,
          label: 'Approve by Division Head',
          targetKind: 'workflow',
        });
      if (grants.has(WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION))
        actions.push({
          code: WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION,
          label: 'Request Revision by Division Head',
          targetKind: 'workflow',
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
