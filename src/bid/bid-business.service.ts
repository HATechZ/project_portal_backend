import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../common/context/request-context';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { PermissionCode } from '../generated/prisma/client';
import { OutboxService } from '../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { BidArchivedReviewRequested, BidBusinessCycleOpened, BidBusinessOutcomeDecided, BidConvertedToProject } from '../contracts/events/bid-business-events';
import type { SessionActor } from '../common/security/session.types';
import { BidBusinessReadinessProvider } from './providers/bid-business-readiness.provider';
import { BidBusinessTransactionProvider } from './providers/bid-business-transaction.provider';
import { BidBusinessRepository } from './repositories/bid-business.repository';
import { BidRepository } from './repositories/bid.repository';

type Command = { bidId: string; note?: string; idempotencyKey?: string };

/** Internal C3 application service. HTTP binding intentionally belongs to C3-C. */
@Injectable()
export class BidBusinessService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repository: BidBusinessRepository,
    private readonly readinessProvider: BidBusinessReadinessProvider,
    private readonly outbox: OutboxService,
    private readonly transactions: BidBusinessTransactionProvider,
    private readonly bids: BidRepository,
  ) {}

  async evaluateReadiness(bidId: string) {
    return this.uow.execute(() => this.readinessProvider.evaluate(bidId), { isolationLevel: 'Serializable' });
  }

  async readiness(bidId: string, actor: SessionActor) {
    allow(actor, PermissionCode.VIEW_BID);
    await this.assertAccessible(bidId, actor);
    const result = await this.evaluateReadiness(bidId);
    return { ready: result.ready, currentCycleId: result.cycleId, totalWorkRequests: result.total, acceptedWorkRequests: result.accepted, blocking: result.blocking };
  }

  async history(bidId: string, actor: SessionActor) {
    allow(actor, PermissionCode.VIEW_BID);
    await this.assertAccessible(bidId, actor);
    return this.uow.execute(() => this.repository.history(bidId));
  }

  async win(command: Command, actor: SessionActor) {
    allow(actor, PermissionCode.DECIDE_BID_OUTCOME);
    await this.assertAccessible(command.bidId, actor);
    const keyed = withRequestKey(command);
    return this.transactions.execute(async () => {
      const replay = await this.repository.replayConversion(keyed.bidId, keyed.idempotencyKey);
      if (replay) return conversionResponse(keyed.bidId, replay);
      await assertStatus(this.uow, keyed.bidId, 'BIDDING');
      const readiness = await this.readinessProvider.evaluate(keyed.bidId);
      if (!readiness.ready) throw conflict('Bid is not ready for a successful outcome.');
      const result = await this.repository.convert({ ...keyed, actorId: actor.id, readiness });
      const origin = { tenantId: RequestContext.requireTenantId(), actorId: actor.id, correlationId: RequestContext.requestId() };
      await this.outbox.enqueue(new BidBusinessOutcomeDecided(origin, { bidId: command.bidId, cycleId: result.cycleId, outcome: 'WIN' }));
      await this.outbox.enqueue(new BidConvertedToProject(origin, { bidId: command.bidId, projectId: result.projectId, cycleId: result.cycleId }));
      return conversionResponse(keyed.bidId, result);
    });
  }

  async reject(command: Command, actor: SessionActor) {
    allow(actor, PermissionCode.DECIDE_BID_OUTCOME);
    allow(actor, PermissionCode.ARCHIVE_BID);
    await this.assertAccessible(command.bidId, actor);
    const keyed = withRequestKey(command);
    return this.transactions.execute(async () => {
      const replay = await this.repository.replayArchive(keyed.bidId, keyed.idempotencyKey);
      if (replay) return outcomeResponse(keyed.bidId, replay);
      await assertStatus(this.uow, keyed.bidId, 'BIDDING');
      const readiness = await this.readinessProvider.evaluate(keyed.bidId);
      if (!readiness.ready) throw conflict('Bid is not ready for a rejected outcome.');
      const result = await this.repository.archive({ ...keyed, actorId: actor.id, readiness });
      await this.outbox.enqueue(new BidBusinessOutcomeDecided({ tenantId: RequestContext.requireTenantId(), actorId: actor.id, correlationId: RequestContext.requestId() }, { bidId: command.bidId, cycleId: result.cycleId, outcome: 'LOSE' }));
      return outcomeResponse(keyed.bidId, result);
    });
  }

  async requestArchivedReview(command: Command, actor: SessionActor) {
    allow(actor, PermissionCode.REQUEST_ARCHIVED_BID_REVIEW);
    await this.assertAccessible(command.bidId, actor);
    const keyed = withRequestKey(command);
    return this.transactions.execute(async () => {
      const replay = await this.repository.replayReview(keyed.bidId, keyed.idempotencyKey);
      if (replay) return { bidId: keyed.bidId, reviewRequestId: replay.id, cycleId: null, outcomeId: null };
      await assertStatus(this.uow, keyed.bidId, 'ARCHIVED');
      const id = await this.repository.requestReview({ ...keyed, actorId: actor.id });
      await this.outbox.enqueue(new BidArchivedReviewRequested({ tenantId: RequestContext.requireTenantId(), actorId: actor.id, correlationId: RequestContext.requestId() }, { bidId: command.bidId, reviewRequestId: id }));
      return { bidId: keyed.bidId, reviewRequestId: id, cycleId: null, outcomeId: null };
    });
  }

  async restore(command: Command, actor: SessionActor) {
    allow(actor, PermissionCode.RESTORE_BID);
    await this.assertAccessible(command.bidId, actor);
    const keyed = withRequestKey(command);
    return this.transactions.execute(async () => {
      const replay = await this.repository.replayRestore(keyed.bidId, keyed.idempotencyKey);
      if (replay) return { bidId: keyed.bidId, cycleId: replay.id, cycleNumber: replay.cycleNumber, outcomeId: null };
      await assertStatus(this.uow, keyed.bidId, 'ARCHIVED');
      const result = await this.repository.restore({ ...keyed, actorId: actor.id });
      await this.outbox.enqueue(new BidBusinessCycleOpened({ tenantId: RequestContext.requireTenantId(), actorId: actor.id, correlationId: RequestContext.requestId() }, { bidId: command.bidId, cycleId: result.cycleId, cycleNumber: result.cycleNumber }));
      return { bidId: keyed.bidId, ...result, outcomeId: null };
    });
  }

  private async assertAccessible(bidId: string, actor: SessionActor) {
    const bid = await this.bids.find(bidId, actor);
    if (!bid) throw new AppException({ code: AppErrorCode.NotFound, status: HttpStatus.NOT_FOUND, message: 'Bid was not found.' });
  }
}

function conversionResponse(bidId: string, result: { projectId: string; projectName: string; projectCode: string | null; outcomeId: string; cycleId: string }) {
  return { bidId, cycleId: result.cycleId, outcomeId: result.outcomeId, directProjectId: result.projectId, directProjectName: result.projectName, directProjectCode: result.projectCode };
}

function outcomeResponse(bidId: string, result: { outcomeId: string; cycleId: string }) {
  return { bidId, cycleId: result.cycleId, outcomeId: result.outcomeId };
}

function allow(actor: SessionActor, permission: PermissionCode) {
  const grant = actor.role.rolePermissions.find(({ revokedAt, permission: value }) => revokedAt === null && value.code === permission);
  if (!grant || !grant.permission.scopeCompatibilities.some(({ scope }) => scope === actor.role.customScope))
    throw new AppException({ code: AppErrorCode.Forbidden, status: HttpStatus.FORBIDDEN, message: "You don't have permission to perform this action." });
}

async function assertStatus(uow: UnitOfWorkService, bidId: string, expected: 'BIDDING' | 'ARCHIVED') {
  const bid = await uow.client.bid.findFirst({ where: { id: bidId, tenantId: RequestContext.requireTenantId() }, select: { statusEvents: { take: 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { toStatus: { select: { code: true } } } } } });
  if (!bid) throw new AppException({ code: AppErrorCode.NotFound, status: HttpStatus.NOT_FOUND, message: 'Bid was not found.' });
  if (bid.statusEvents[0]?.toStatus.code !== expected) throw conflict(`Bid must be ${expected.toLowerCase()}.`);
}

function conflict(message: string) { return new AppException({ code: AppErrorCode.Conflict, status: HttpStatus.CONFLICT, message }); }

function withRequestKey(command: Command): Required<Pick<Command, 'bidId' | 'idempotencyKey'>> & Pick<Command, 'note'> {
  return { ...command, idempotencyKey: command.idempotencyKey ?? RequestContext.requestId() ?? randomUUID() };
}
