import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { deriveProjectCode } from '../../common/documents/document-naming';
import { createDirectProject, normalizeDirectProjectName } from '../../common/projects/direct-project-creation';
import { BidOutcomeCode } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { BidBusinessReadiness } from '../providers/bid-business-readiness.provider';

@Injectable()
export class BidBusinessRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) { super(uow); }

  private tenantId() { return RequestContext.requireTenantId(); }

  async replayConversion(bidId: string, idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    const row = await this.db.bidProjectConversion.findFirst({ where: { tenantId: this.tenantId(), bidId, idempotencyKey }, select: { directProjectId: true, businessCycleId: true, bidBusinessOutcomeId: true, directProject: { select: { name: true, projectCode: true } } } });
    return row ? { projectId: row.directProjectId, projectName: row.directProject.name, projectCode: row.directProject.projectCode, outcomeId: row.bidBusinessOutcomeId, cycleId: row.businessCycleId } : null;
  }

  async replayArchive(bidId: string, idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    const row = await this.db.bidBusinessOutcome.findFirst({ where: { tenantId: this.tenantId(), bidId, outcome: BidOutcomeCode.LOSE, idempotencyKey }, select: { id: true, businessCycleId: true } });
    return row ? { outcomeId: row.id, cycleId: row.businessCycleId } : null;
  }

  async replayReview(bidId: string, idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    return this.db.bidArchivedReviewRequest.findFirst({ where: { tenantId: this.tenantId(), bidId, idempotencyKey }, select: { id: true } });
  }

  async replayRestore(bidId: string, idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    return this.db.bidBusinessCycle.findFirst({ where: { tenantId: this.tenantId(), bidId, idempotencyKey }, select: { id: true, cycleNumber: true } });
  }

  async history(bidId: string) {
    const tenantId = this.tenantId();
    const bid = await this.db.bid.findFirst({
      where: { id: bidId, tenantId },
      select: {
        businessCycles: { orderBy: [{ cycleNumber: 'asc' }, { id: 'asc' }], select: { id: true, cycleNumber: true, openedAt: true, closedAt: true } },
        businessOutcomes: { orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }], select: { id: true, businessCycleId: true, outcome: true, decidedAt: true, note: true } },
        projectConversion: { select: { id: true, bidBusinessOutcomeId: true, businessCycleId: true, convertedAt: true, directProject: { select: { id: true, name: true, projectCode: true } } } },
      },
    });
    if (!bid) throw new Error('BID_NOT_FOUND');
    return {
      bidId,
      cycles: bid.businessCycles.map((cycle) => ({ id: cycle.id, cycleNumber: cycle.cycleNumber, openedAt: cycle.openedAt, closedAt: cycle.closedAt })),
      outcomes: bid.businessOutcomes.map((outcome) => ({ id: outcome.id, cycleId: outcome.businessCycleId, outcome: outcome.outcome, decidedAt: outcome.decidedAt, note: outcome.note })),
      conversion: bid.projectConversion ? { id: bid.projectConversion.id, cycleId: bid.projectConversion.businessCycleId, outcomeId: bid.projectConversion.bidBusinessOutcomeId, convertedAt: bid.projectConversion.convertedAt, directProject: bid.projectConversion.directProject } : null,
    };
  }

  async archive(input: { bidId: string; actorId: string; note?: string; idempotencyKey?: string; readiness: BidBusinessReadiness }) {
    const tenantId = this.tenantId();
    const cycleId = input.readiness.cycleId!;
    const conversion = await this.db.bidProjectConversion.findFirst({ where: { tenantId, bidId: input.bidId }, select: { id: true } });
    if (conversion) throw new Error('BID_ALREADY_CONVERTED');
    const outcomeId = randomUUID();
    await this.db.bidBusinessOutcome.create({ data: { id: outcomeId, tenantId, bidId: input.bidId, businessCycleId: cycleId, outcome: BidOutcomeCode.LOSE, decidedByActorId: input.actorId, note: input.note, correlationId: RequestContext.requestId(), idempotencyKey: input.idempotencyKey } });
    const bid = await this.db.bid.findFirstOrThrow({ where: { id: input.bidId, tenantId }, select: { statusEvents: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { toStatusId: true } } } });
    const archived = await this.db.bidStatus.findUniqueOrThrow({ where: { code: 'ARCHIVED' }, select: { id: true } });
    await this.db.bidStatusEvent.create({ data: { id: randomUUID(), tenantId, bidId: input.bidId, fromStatusId: bid.statusEvents[0]?.toStatusId, toStatusId: archived.id, changedByActorId: input.actorId, reason: input.note } });
    await this.db.bidBusinessCycle.update({ where: { id: cycleId }, data: { closedAt: new Date() } });
    return { outcomeId, cycleId };
  }

  async convert(input: { bidId: string; actorId: string; note?: string; idempotencyKey?: string; readiness: BidBusinessReadiness }) {
    const tenantId = this.tenantId();
    const cycleId = input.readiness.cycleId!;
    const conversion = await this.db.bidProjectConversion.findFirst({ where: { tenantId, bidId: input.bidId }, select: { id: true } });
    if (conversion) throw new Error('BID_ALREADY_CONVERTED');
    const bid = await this.db.bid.findFirstOrThrow({ where: { id: input.bidId, tenantId }, select: { id: true, name: true, clientId: true, polId: true, podId: true, cargoId: true, vesselId: true, polNameSnapshot: true, podNameSnapshot: true, cargoCodeSnapshot: true, vesselCodeSnapshot: true, shipmentNumber: true, statusEvents: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { toStatus: { select: { code: true } } } } } });
    if (bid.statusEvents[0]?.toStatus.code !== 'BIDDING') throw new Error('BID_NOT_ACTIVE');
    const projectCode = deriveProjectCode(bid.name, bid.polNameSnapshot, bid.podNameSnapshot);
    const suffix = ` - ${projectCode}`;
    const projectName = bid.name.length + suffix.length > 220 ? bid.name.slice(0, 220 - suffix.length).trimEnd() + suffix : bid.name + suffix;
    const projectId = randomUUID();
    await createDirectProject(this.db, { id: projectId, tenantId, name: projectName, normalizedName: normalizeDirectProjectName(projectName), clientId: bid.clientId, polId: bid.polId, podId: bid.podId, cargoId: bid.cargoId, vesselId: bid.vesselId, projectCode, shipmentNumber: bid.shipmentNumber, actorId: input.actorId, snapshots: { polName: bid.polNameSnapshot, podName: bid.podNameSnapshot, cargoCode: bid.cargoCodeSnapshot, vesselCode: bid.vesselCodeSnapshot } });
    const outcomeId = randomUUID();
    await this.db.bidBusinessOutcome.create({ data: { id: outcomeId, tenantId, bidId: input.bidId, businessCycleId: cycleId, outcome: BidOutcomeCode.WIN, decidedByActorId: input.actorId, note: input.note, correlationId: RequestContext.requestId(), idempotencyKey: input.idempotencyKey } });
    await this.db.bidProjectConversion.create({ data: { id: randomUUID(), tenantId, bidId: input.bidId, directProjectId: projectId, businessCycleId: cycleId, bidBusinessOutcomeId: outcomeId, convertedByActorId: input.actorId, note: input.note, correlationId: RequestContext.requestId(), idempotencyKey: input.idempotencyKey } });
    await this.db.bidBusinessCycle.update({ where: { id: cycleId }, data: { closedAt: new Date() } });
    return { projectId, projectName, projectCode, outcomeId, cycleId };
  }

  async requestReview(input: { bidId: string; actorId: string; note?: string; idempotencyKey?: string }) {
    const tenantId = this.tenantId();
    const rejected = await this.db.bidBusinessOutcome.findFirstOrThrow({ where: { tenantId, bidId: input.bidId, outcome: BidOutcomeCode.LOSE }, orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    const id = randomUUID();
    await this.db.bidArchivedReviewRequest.create({ data: { id, tenantId, bidId: input.bidId, rejectedOutcomeId: rejected.id, requestedByActorId: input.actorId, note: input.note, correlationId: RequestContext.requestId(), idempotencyKey: input.idempotencyKey } });
    return id;
  }

  async restore(input: { bidId: string; actorId: string; note?: string; idempotencyKey?: string }) {
    const tenantId = this.tenantId();
    const review = await this.db.bidArchivedReviewRequest.findFirstOrThrow({ where: { tenantId, bidId: input.bidId }, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], select: { rejectedOutcomeId: true } });
    const openCycle = await this.db.bidBusinessCycle.findFirst({ where: { tenantId, bidId: input.bidId, closedAt: null }, select: { id: true } });
    if (openCycle) throw new Error('BID_OPEN_CYCLE');
    const last = await this.db.bidBusinessCycle.findFirst({ where: { tenantId, bidId: input.bidId }, orderBy: [{ cycleNumber: 'desc' }], select: { cycleNumber: true } });
    const cycleId = randomUUID();
    const cycleNumber = (last?.cycleNumber ?? 0) + 1;
    const bid = await this.db.bid.findFirstOrThrow({ where: { id: input.bidId, tenantId }, select: { statusEvents: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { toStatusId: true } } } });
    const bidding = await this.db.bidStatus.findUniqueOrThrow({ where: { code: 'BIDDING' }, select: { id: true } });
    await this.db.bidStatusEvent.create({ data: { id: randomUUID(), tenantId, bidId: input.bidId, fromStatusId: bid.statusEvents[0]?.toStatusId, toStatusId: bidding.id, changedByActorId: input.actorId, reason: input.note } });
    await this.db.bidBusinessCycle.create({ data: { id: cycleId, tenantId, bidId: input.bidId, cycleNumber, openedByActorId: input.actorId, reopenedFromOutcomeId: review.rejectedOutcomeId, idempotencyKey: input.idempotencyKey } });
    return { cycleId, cycleNumber };
  }
}
