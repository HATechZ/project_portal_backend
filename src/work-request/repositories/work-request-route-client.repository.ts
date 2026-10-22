import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { WorkRequestRouteReconsiderationDecisionCode as ReconsiderationDecision, WorkRequestRouteStepKind as StepKind, WorkRequestV1StateCode as State } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Phase 7 route gateway. C1 package/decision rows remain the source of truth;
 * this repository only binds them to the route's exact originating gateway. */
@Injectable()
export class WorkRequestRouteClientRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) { super(uow); }
  isRoute(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, select: { id: true } }));
  }
  context(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestRoute.findFirst({
      where: { tenantId, workRequestId },
      include: {
        responsibleOriginatingLead: { select: { memberId: true } },
        projection: { include: { routeStep: true } },
        steps: { orderBy: { ordinal: 'asc' }, select: { id: true, kind: true, divisionId: true, ordinal: true, activatedAt: true, completedAt: true } },
        workRequest: { select: { bid: { select: { clientId: true, client: { select: { companyId: true } } } }, directProject: { select: { clientId: true, client: { select: { companyId: true } } } }, events: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { resultingState: true } }, clientSubmissions: { orderBy: { submissionNumber: 'desc' }, take: 1, include: { decision: true } } } },
      },
    }));
  }
  versions(workRequestId: string, ids: string[]) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestV1DocumentVersion.findMany({ where: { tenantId, id: { in: ids }, document: { workRequestId } }, select: { id: true } }));
  }
  list(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestV1ClientSubmission.findMany({ where: { tenantId, workRequestId }, orderBy: { submissionNumber: 'asc' }, include: { items: true, decision: true } }));
  }
  async submit(input: { workRequestId: string; actorId: string; versionIds: string[]; note?: string; idempotencyKey?: string; correlationId?: string }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId: input.workRequestId }, include: { projection: { include: { routeStep: true } }, steps: true, divisionCycles: true, workRequest: { select: { clientSubmissions: { orderBy: { submissionNumber: 'desc' }, take: 1, include: { decision: true } } } } } });
      if (!route) return null;
      const current = route.projection?.routeStep;
      const resubmission = route.workRequest.clientSubmissions[0]?.decision?.decision === 'REQUEST_REVISION';
      const finalCycle = route.divisionCycles.find((cycle: any) => cycle.id === route.projection?.divisionCycleId);
      if (current?.kind !== StepKind.ORIGIN_FINAL_REVIEW || (!resubmission && (!finalCycle?.completedAt || current.completedAt))) return { kind: 'position' as const };
      const existing = input.idempotencyKey && await db.workRequestV1Event.findFirst({ where: { tenantId, workRequestId: input.workRequestId, idempotencyKey: input.idempotencyKey }, select: { id: true } });
      if (existing) return { kind: 'duplicate' as const };
      const number = (await db.workRequestV1ClientSubmission.count({ where: { tenantId, workRequestId: input.workRequestId } })) + 1;
      const at = new Date();
      const submission = await db.workRequestV1ClientSubmission.create({ data: { id: randomUUID(), tenantId, workRequestId: input.workRequestId, submissionNumber: number, createdByActorId: input.actorId, submittedByActorId: input.actorId, submittedAt: at, items: { create: input.versionIds.map((documentVersionId, position) => ({ id: randomUUID(), tenantId, documentVersionId, position })) } }, include: { items: true } });
      const client = route.steps.find((step: any) => step.kind === StepKind.CLIENT);
      if (!client) return { kind: 'position' as const };
      // The first submission closes the immutable Origin-final occurrence and
      // activates Client.  A resubmission reuses that Client occurrence: it
      // only restores the projection and never rewrites completed history.
      if (!resubmission) await db.workRequestRouteStep.update({ where: { id: current.id }, data: { completedAt: at } });
      if (!client.activatedAt) await db.workRequestRouteStep.update({ where: { id: client.id }, data: { activatedAt: at } });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: route.id, tenantId } }, data: { routeStepId: client.id, divisionCycleId: null, teamStepId: null, memberStepId: null, updatedAt: at } });
      const event = await db.workRequestV1Event.create({ data: { id: randomUUID(), tenantId, workRequestId: input.workRequestId, action: resubmission ? 'CLIENT_REVISION_RESUBMITTED' : 'CLIENT_REVIEW_SUBMITTED', priorState: route.workRequest.events?.[0]?.resultingState ?? State.FINAL_RELEASE, resultingState: State.CLIENT_REVIEW, performedByActorId: input.actorId, occurredAt: at, note: input.note, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId, clientSubmissionId: submission.id } });
      await db.workRequestRouteEvent.create({ data: { id: randomUUID(), tenantId, routeId: route.id, routeStepId: client?.id ?? current.id, action: 'CLIENT_PACKAGE_SUBMITTED', performedByActorId: input.actorId, correlationId: input.correlationId, idempotencyKey: input.idempotencyKey } });
      return { kind: 'ok' as const, submission, event };
    }, { isolationLevel: 'Serializable' });
  }
  async decide(input: { workRequestId: string; submissionId: string; actorId: string; decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION'; note?: string; idempotencyKey?: string; correlationId?: string }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId: input.workRequestId }, include: { projection: { include: { routeStep: true } }, steps: true, workRequest: { select: { clientSubmissions: { orderBy: { submissionNumber: 'desc' }, take: 1, include: { decision: true } } } } } });
      const submission = route?.workRequest.clientSubmissions[0];
      if (!route || route.projection?.routeStep?.kind !== StepKind.CLIENT || !submission || submission.id !== input.submissionId || submission.decision) return null;
      const at = new Date();
      const decision = await db.workRequestV1ClientDecision.create({ data: { id: randomUUID(), tenantId, workRequestId: input.workRequestId, submissionId: input.submissionId, decision: input.decision, decidedByActorId: input.actorId, note: input.note, decidedAt: at, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId } });
      const state = input.decision === 'ACCEPT' ? State.ACCEPTED : input.decision === 'REJECT' ? State.REJECTED : State.CLIENT_REVISION_REQUESTED;
      const event = await db.workRequestV1Event.create({ data: { id: randomUUID(), tenantId, workRequestId: input.workRequestId, action: `CLIENT_${input.decision}`, priorState: State.CLIENT_REVIEW, resultingState: state, performedByActorId: input.actorId, occurredAt: at, note: input.note, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId, clientSubmissionId: input.submissionId, clientDecisionId: decision.id } });
      if (input.decision === 'REQUEST_REVISION') {
        const final = route.steps.find((step: any) => step.kind === StepKind.ORIGIN_FINAL_REVIEW);
        if (final) await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: route.id, tenantId } }, data: { routeStepId: final.id, updatedAt: at } });
      }
      await db.workRequestRouteEvent.create({ data: { id: randomUUID(), tenantId, routeId: route.id, routeStepId: route.projection.routeStepId, action: `CLIENT_${input.decision}`, performedByActorId: input.actorId, correlationId: input.correlationId, idempotencyKey: input.idempotencyKey } });
      return { decision, state, event };
    }, { isolationLevel: 'Serializable' });
  }
  async requestReconsideration(workRequestId: string, actorId: string, reason: string | undefined, idempotencyKey?: string, correlationId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, include: { workRequest: { select: { events: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { resultingState: true } } } } } });
      if (!route || route.workRequest.events[0]?.resultingState !== State.REJECTED) return null;
      const existing = await db.workRequestRouteReconsideration.findFirst({ where: { tenantId, workRequestId }, include: { decision: true } });
      if (existing) return { existing };
      const reconsideration = await db.workRequestRouteReconsideration.create({ data: { id: randomUUID(), tenantId, routeId: route.id, workRequestId, requestedByActorId: actorId, reason, idempotencyKey, correlationId } });
      await db.workRequestRouteEvent.create({ data: { id: randomUUID(), tenantId, routeId: route.id, action: 'RECONSIDERATION_REQUESTED', performedByActorId: actorId, correlationId, idempotencyKey } });
      return { reconsideration };
    }, { isolationLevel: 'Serializable' });
  }
  async decideReconsideration(workRequestId: string, actorId: string, decision: ReconsiderationDecision, note: string | undefined, idempotencyKey?: string, correlationId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, include: { steps: true, workRequest: { select: { events: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { resultingState: true } } } } } });
      const request = await db.workRequestRouteReconsideration.findFirst({ where: { tenantId, workRequestId }, include: { decision: true } });
      if (!route || !request || request.decision || route.workRequest.events[0]?.resultingState !== State.REJECTED) return null;
      const at = new Date();
      const written = await db.workRequestRouteReconsiderationDecision.create({ data: { id: randomUUID(), tenantId, reconsiderationId: request.id, decidedByActorId: actorId, decision, note, decidedAt: at, idempotencyKey, correlationId } });
      if (decision === ReconsiderationDecision.ACCEPT) {
        const final = route.steps.find((step: any) => step.kind === StepKind.ORIGIN_FINAL_REVIEW);
        if (final) await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: route.id, tenantId } }, data: { routeStepId: final.id, updatedAt: at } });
        await db.workRequestV1Event.create({ data: { id: randomUUID(), tenantId, workRequestId, action: 'RECONSIDERATION_ACCEPTED', priorState: State.REJECTED, resultingState: State.FINAL_RELEASE, performedByActorId: actorId, occurredAt: at, note, idempotencyKey, correlationId } });
      }
      await db.workRequestRouteEvent.create({ data: { id: randomUUID(), tenantId, routeId: route.id, action: `RECONSIDERATION_${decision}`, performedByActorId: actorId, correlationId, idempotencyKey } });
      return { decision: written, reopened: decision === ReconsiderationDecision.ACCEPT };
    }, { isolationLevel: 'Serializable' });
  }
}
