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
    const revision = route.projection?.openRevision;
    if (route.projection?.openRevisionId) {
      const scope = actor.role.customScope;
      const compatible = revision?.classification === 'CROSS_DIVISION_FORMAL'
        ? scope === 'division'
        : revision?.classification === 'INTERNAL_TEAM'
          ? scope === 'division' || scope === 'team'
          : scope === 'division' || scope === 'team' || scope === 'member';
      return revision && !revision.submittedAt && !revision.resumedAt &&
        (admin || (revision.sourceActorId === actor.id && compatible)) &&
        hasPermission(actor, PermissionCode.SUBMIT_WORK_REQUEST)
        ? [action('RESUBMIT_REVISION', 'Resubmit revision', 'revision')] : [];
    }
    const actions: { code: string; label: string; targetKind: string }[] = [];
    const cycle = route.divisionCycles.find((item: any) => item.id === route.projection?.divisionCycleId);
    const current = route.steps.find((item: any) => item.id === route.projection?.routeStepId);
    const isDivisionScoped = actor.role.customScope === 'division';
    const isOriginatingLeadScoped =
      actor.role.customScope === 'company' || isDivisionScoped;
    const responsibleOriginLead =
      admin ||
      (isOriginatingLeadScoped &&
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
        ? responsibleOriginLead && isDivisionScoped
        : activeDivisionLead);
    const team = cycle?.teamSteps.find((item: any) => item.id === route.projection?.teamStepId && item.activatedAt && !item.completedAt);
    const member = team?.memberSteps.find((item: any) => item.id === route.projection?.memberStepId && item.activatedAt && !item.submittedAt);
    const teamOwner = actor.role.customScope === 'team' && team?.team.leadMemberId === memberId;
    const memberOwner = actor.role.customScope === 'member' && member?.memberId === memberId;
    const memberSource = team?.memberSteps.some((step: any) => step.activatedAt && step.memberId !== memberId);
    const teamSource = cycle?.teamSteps.some((step: any) => step.activatedAt && step.team.leadMemberId && (divisionLead || step.id !== team?.id));
    const divisionSource = route.divisionCycles.some((item: any) => item.id !== cycle?.id && item.routeStep?.divisionId !== cycle?.routeStep?.divisionId);
    if (hasPermission(actor, PermissionCode.REQUEST_WORK_REQUEST_REVISION) &&
      (((memberOwner || teamOwner) && memberSource) || (teamOwner && teamSource) || (divisionLead && cycle && (teamSource || divisionSource))))
      actions.push(action('REQUEST_REVISION', 'Request revision', 'revision'));
    if (
      responsibleOriginLead &&
      current?.kind === StepKind.ORIGIN_START &&
      hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_DIVISION)
    )
      actions.push(
        action('WR_ASSIGN_DIVISION', 'Assign Division', 'division'),
      );
    if (divisionLead && cycle && !cycle.completedAt && !cycle.teamSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_TEAM)) actions.push(action('DEFINE_TEAM_SEQUENCE', 'Define Team sequence', 'division-cycle'));
    if (responsibleOriginLead && hasPermission(actor, PermissionCode.UPDATE_WORK_REQUEST)) actions.push(action('AMEND_ROUTE', 'Modify future route', 'route'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && !team?.memberSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)) actions.push(action('DEFINE_MEMBER_SEQUENCE', 'Define Member sequence', 'team-step'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && team?.memberSteps.length && hasPermission(actor, PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)) actions.push(action('APPEND_MEMBER_STEP', 'Append Member step', 'team-step'));
    if ((admin || (actor.role.customScope === 'member' && member?.memberId === memberId)) && member && hasPermission(actor, PermissionCode.SUBMIT_WORK_REQUEST)) actions.push(action('SUBMIT_MEMBER_STEP', 'Submit Member step', 'member-step'));
    if ((admin || (actor.role.customScope === 'team' && team?.team.leadMemberId === memberId)) && team?.memberSteps.length && team.memberSteps.every((item: any) => item.submittedAt) && hasPermission(actor, PermissionCode.APPROVE_WORK_REQUEST_REVIEW)) actions.push(action('COMPLETE_TEAM_STEP', 'Complete Team step', 'team-step'));
    if (divisionLead && cycle?.completedAt && current?.kind !== StepKind.ORIGIN_FINAL_REVIEW && hasPermission(actor, PermissionCode.ROUTE_FOR_REVIEW)) actions.push(action('FORWARD_ROUTE', 'Forward to next route step', 'route-step'));
    if (responsibleOriginLead && current?.kind === StepKind.ORIGIN_FINAL_REVIEW && cycle?.completedAt && hasPermission(actor, PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW)) actions.push(action('SUBMIT_CLIENT_PACKAGE', 'Submit Client package', 'client-package'));
    let hasRequestInfoRecipient = false;
    if (
      !admin &&
      memberId &&
      hasPermission(actor, PermissionCode.REQUEST_INFO)
    ) {
      const recipients = await this.communications.recipientActorIds(
        workRequestId,
        actor.id,
        memberId,
      );
      hasRequestInfoRecipient = !!recipients?.length;
    }
    if (hasRequestInfoRecipient)
      actions.push({
        code: WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        label: 'Request Information',
        targetKind: 'info-request',
      });
    return actions;
  }
}
function action(code: string, label: string, targetKind: string) { return { code, label, targetKind }; }
function hasPermission(actor: SessionActor, required: PermissionCode) {
  return actor.role.rolePermissions.some(({ revokedAt, permission }) => revokedAt === null && permission.code === required && (actor.role.customScope === null || permission.scopeCompatibilities.some(({ scope }) => scope === actor.role.customScope)));
}
