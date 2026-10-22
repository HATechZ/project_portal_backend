import { HttpStatus, Injectable } from '@nestjs/common';
import { PermissionCode, WorkRequestRouteReconsiderationDecisionCode as ReconsiderationDecision, WorkRequestRouteStepKind as StepKind } from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import type { SessionActor } from '../../common/security/session.types';
import { workRequestTransitionRequestMetadata } from './work-request-transition.definitions';
import { WorkRequestRouteClientRepository } from '../repositories/work-request-route-client.repository';

@Injectable()
export class WorkRequestRouteClientProvider {
  constructor(private readonly repository: WorkRequestRouteClientRepository) {}
  async isRoute(id: string) { return !!(await this.repository.isRoute(id)); }
  async submit(id: string, input: { documentVersionIds: string[]; note?: string }, actor: SessionActor) {
    const context: any = await this.requiredGateway(id, actor, PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW);
    if (context.projection?.routeStep?.kind !== StepKind.ORIGIN_FINAL_REVIEW) throw conflict('Work Request is not at Originating Division final review.');
    if (!input.documentVersionIds.length || input.documentVersionIds.length !== new Set(input.documentVersionIds).size) throw bad('Select distinct document versions.');
    if (context.workRequest.clientSubmissions[0]?.decision?.decision === 'REQUEST_REVISION' && !has(actor, PermissionCode.SUBMIT_CLIENT_REVISION)) throw forbidden();
    if ((await this.repository.versions(id, input.documentVersionIds)).length !== input.documentVersionIds.length) throw bad('A selected document version is invalid for this Work Request.');
    const meta = workRequestTransitionRequestMetadata();
    const result: any = await this.repository.submit({ workRequestId: id, actorId: actor.id, versionIds: input.documentVersionIds, note: input.note, ...meta });
    if (!result) throw notFound();
    if (result.kind === 'duplicate') throw conflict('This workflow request has already been applied.');
    if (result.kind === 'position') throw conflict('Work Request final-review position is invalid.');
    return submission(result.submission);
  }
  async decide(id: string, submissionId: string, input: { decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION'; note?: string }, actor: SessionActor) {
    const context: any = await this.repository.context(id);
    if (!context) throw notFound();
    client(actor, context, decisionPermission(input.decision));
    if (input.decision === 'REQUEST_REVISION' && !input.note) throw bad('A revision reason is required.');
    const meta = workRequestTransitionRequestMetadata();
    const result: any = await this.repository.decide({ workRequestId: id, submissionId, actorId: actor.id, decision: input.decision, note: input.note, ...meta });
    if (!result) throw conflict('Submission is stale or already decided.');
    return { id: result.decision.id, decision: result.decision.decision, decidedAt: result.decision.decidedAt, currentState: result.state };
  }
  async list(id: string, actor: SessionActor) {
    const context: any = await this.repository.context(id);
    if (!context) throw notFound();
    if (actor.clientContact) client(actor, context, PermissionCode.VIEW_WORK_REQUEST);
    else await this.requiredGateway(id, actor, PermissionCode.VIEW_WORK_REQUEST);
    return (await this.repository.list(id)).map(submission);
  }
  async requestReconsideration(id: string, reason: string | undefined, actor: SessionActor) {
    await this.requiredGateway(id, actor, PermissionCode.REQUEST_WORK_REQUEST_REVISION);
    const meta = workRequestTransitionRequestMetadata();
    const result: any = await this.repository.requestReconsideration(id, actor.id, reason, meta.idempotencyKey, meta.correlationId);
    if (!result) throw conflict('Work Request is not rejected.');
    if (result.existing) throw conflict('Reconsideration was already requested for this Work Request.');
    return { id: result.reconsideration.id, requestedAt: result.reconsideration.requestedAt };
  }
  async coordinateRevision(id: string, actor: SessionActor) {
    const context: any = await this.requiredGateway(id, actor, PermissionCode.ROUTE_FOR_REVIEW);
    if (context.workRequest.events[0]?.resultingState !== 'CLIENT_REVISION_REQUESTED' || context.projection?.routeStep?.kind !== StepKind.ORIGIN_FINAL_REVIEW) throw conflict('Work Request is not awaiting Originating Division revision handling.');
    return { routeStepId: context.projection.routeStepId, currentState: context.workRequest.events[0].resultingState };
  }
  async decideReconsideration(id: string, decision: ReconsiderationDecision, note: string | undefined, actor: SessionActor) {
    const context: any = await this.repository.context(id);
    if (!context) throw notFound();
    client(actor, context, decision === ReconsiderationDecision.ACCEPT ? PermissionCode.ACCEPT_FINAL_DELIVERY : PermissionCode.REJECT_FINAL_DELIVERY);
    const meta = workRequestTransitionRequestMetadata();
    const result: any = await this.repository.decideReconsideration(id, actor.id, decision, note, meta.idempotencyKey, meta.correlationId);
    if (!result) throw conflict('Reconsideration is not awaiting a Client decision.');
    return { id: result.decision.id, decision: result.decision.decision, decidedAt: result.decision.decidedAt, reopened: result.reopened };
  }
  private async requiredGateway(id: string, actor: SessionActor, permission: PermissionCode) {
    const context: any = await this.repository.context(id);
    if (!context) throw notFound();
    if (!actor.member?.isActive || !['company', 'division'].includes(actor.role.customScope ?? '') || context.responsibleOriginatingLead.memberId !== actor.member.id || !has(actor, permission)) throw forbidden();
    return context;
  }
}
function submission(value: any) { return { id: value.id, submissionNumber: value.submissionNumber, submittedAt: value.submittedAt, documentVersionIds: value.items.map((item: any) => item.documentVersionId), decision: null }; }
function decisionPermission(decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION') { return decision === 'ACCEPT' ? PermissionCode.ACCEPT_FINAL_DELIVERY : decision === 'REJECT' ? PermissionCode.REJECT_FINAL_DELIVERY : PermissionCode.REQUEST_REVISION; }
function has(actor: SessionActor, permission: PermissionCode) { return actor.role.rolePermissions.some(({ revokedAt, permission: grant }) => revokedAt === null && grant.code === permission && (actor.role.customScope === null || grant.scopeCompatibilities.some(({ scope }) => scope === actor.role.customScope))); }
function client(actor: SessionActor, context: any, permission: PermissionCode) { const parent = context.workRequest.bid ?? context.workRequest.directProject; if (!['client', 'client_contact'].includes(actor.role.customScope ?? '') || !actor.clientContact?.isActive || !actor.clientContact.client.isActive || actor.clientContact.clientId !== parent?.clientId || !has(actor, permission)) throw forbidden(); }
function error(code: AppErrorCode, status: HttpStatus, message: string) { return new AppException({ code, status, message }); }
function bad(message: string) { return error(AppErrorCode.BadRequest, HttpStatus.BAD_REQUEST, message); }
function conflict(message: string) { return error(AppErrorCode.Conflict, HttpStatus.CONFLICT, message); }
function forbidden() { return error(AppErrorCode.Forbidden, HttpStatus.FORBIDDEN, "You don't have permission to perform this action."); }
function notFound() { return error(AppErrorCode.NotFound, HttpStatus.NOT_FOUND, 'Work Request route was not found.'); }
