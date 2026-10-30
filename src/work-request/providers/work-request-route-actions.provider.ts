import { Injectable } from '@nestjs/common';
import { PermissionCode, WorkflowActionCode } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';
import { WorkRequestCommunicationRepository } from '../repositories/work-request-communication.repository';
import { WorkRequestRouteStepKind as StepKind } from '../../generated/prisma/client';

/** Route actions are derived from current responsibility, never a role label.
 * `null` means the request is a historical V1 request and must retain its V1
 * action provider. */
@Injectable()
export class WorkRequestRouteActionsProvider {
  constructor(private readonly communications: WorkRequestCommunicationRepository) {}
  async available(workRequestId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    if (!admin && (!actor.member?.id || !actor.member.isActive)) return [];
    const route: any = await this.communications.route(workRequestId);
    if (!route) return null;
    const memberId = actor.member?.id;
    if (!admin && !(await this.communications.isRelatedActor(workRequestId, memberId!))) return [];
    const recipients = memberId
      ? await this.communications.recipientActorIds(workRequestId, actor.id, memberId)
      : [];
    const actions: { code: string; label: string; targetKind: string }[] = [];
    const cycle = route.divisionCycles.find((item: any) => item.id === route.projection?.divisionCycleId);
    const current = route.steps.find((item: any) => item.id === route.projection?.routeStepId);
    const isDivisionScoped = actor.role.customScope === 'division';
    const responsibleOriginLead =
      admin ||
      (isDivisionScoped &&
        route.responsibleOriginatingLead.memberId === memberId &&
        route.responsibleOriginatingLead.revokedAt === null &&
        route.responsibleOriginatingLead.member.isActive &&
        route.responsibleOriginatingLead.division.isActive);
    const activeDivisionLead =
      isDivisionScoped &&
      cycle?.routeStep?.divisionId &&
      actor.member?.divisionLeadsByMemberId.some(
        (lead) => lead.divisionId === cycle.routeStep.divisionId,
      );
    const divisionLead =
      admin ||
      (current?.kind === StepKind.ORIGIN_START
        ? responsibleOriginLead
        : activeDivisionLead);
    const team = cycle?.teamSteps.find((item: any) => item.id === route.projection?.teamStepId && item.activatedAt && !item.completedAt);
    const member = team?.memberSteps.find((item: any) => item.id === route.projection?.memberStepId && item.activatedAt && !item.submittedAt);
    if (divisionLead && !cycle.completedAt && !cycle.teamSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_TEAM)) actions.push(action('DEFINE_TEAM_SEQUENCE', 'Define Team sequence', 'division-cycle'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && !team?.memberSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)) actions.push(action('DEFINE_MEMBER_SEQUENCE', 'Define Member sequence', 'team-step'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && team?.memberSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)) actions.push(action('APPEND_MEMBER_STEP', 'Append Member step', 'team-step'));
    if ((admin || (actor.role.customScope === 'member' && member?.memberId === memberId)) && member && hasPermission(actor, PermissionCode.SUBMIT_WORK_REQUEST)) actions.push(action('SUBMIT_MEMBER_STEP', 'Submit Member step', 'member-step'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && team?.memberSteps.length && team.memberSteps.every((item: any) => item.submittedAt) && hasPermission(actor, PermissionCode.APPROVE_WORK_REQUEST_REVIEW)) actions.push(action('COMPLETE_TEAM_STEP', 'Complete Team step', 'team-step'));
    if (divisionLead && cycle?.completedAt && current?.kind !== StepKind.ORIGIN_FINAL_REVIEW && hasPermission(actor, PermissionCode.ROUTE_FOR_REVIEW)) actions.push(action('FORWARD_ROUTE', 'Forward to next route step', 'route-step'));
    if (responsibleOriginLead && current?.kind === StepKind.ORIGIN_FINAL_REVIEW && cycle?.completedAt && hasPermission(actor, PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW)) actions.push(action('SUBMIT_CLIENT_PACKAGE', 'Submit Client package', 'client-package'));
    if ((recipients ?? []).length && hasPermission(actor, PermissionCode.REQUEST_INFO)) actions.push({ code: WorkflowActionCode.REQUEST_WORKFLOW_INFO, label: 'Communicate privately', targetKind: 'route-conversation' });
    return actions;
  }
}
function action(code: string, label: string, targetKind: string) { return { code, label, targetKind }; }
function hasPermission(actor: SessionActor, required: PermissionCode) {
  return actor.role.rolePermissions.some(({ revokedAt, permission }) => revokedAt === null && permission.code === required && (actor.role.customScope === null || permission.scopeCompatibilities.some(({ scope }) => scope === actor.role.customScope)));
}
