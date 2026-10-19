import { RequestContext } from '../common/context/request-context';
import { PermissionCode } from '../generated/prisma/client';
import { BidBusinessService } from './bid-business.service';

const actor = (permissions: PermissionCode[] = Object.values(PermissionCode)) => ({
  id: 'actor-a',
  role: {
    customScope: 'TENANT',
    rolePermissions: permissions.map((code) => ({
      revokedAt: null,
      permission: { code, scopeCompatibilities: [{ scope: 'TENANT' }] },
    })),
  },
}) as never;

describe('BidBusinessService command replay', () => {
  function subject(replay: Record<string, unknown> = {}) {
    const repository = {
      replayConversion: jest.fn().mockResolvedValue(replay.conversion ?? null),
      replayArchive: jest.fn().mockResolvedValue(replay.archive ?? null),
      replayReview: jest.fn().mockResolvedValue(replay.review ?? null),
      replayRestore: jest.fn().mockResolvedValue(replay.restore ?? null),
      convert: jest.fn(), archive: jest.fn(), requestReview: jest.fn(), restore: jest.fn(),
    };
    const readiness = { evaluate: jest.fn().mockResolvedValue({ ready: true, cycleId: 'cycle-a' }) };
    const outbox = { enqueue: jest.fn() };
    const uow = { execute: jest.fn(async (work: () => Promise<unknown>) => work()), client: { bid: { findFirst: jest.fn() } } };
    const transactions = { execute: jest.fn(async (work: () => Promise<unknown>) => work()) };
    const bids = { find: jest.fn().mockResolvedValue({ id: 'bid-a' }) };
    return { service: new BidBusinessService(uow as never, repository as never, readiness as never, outbox as never, transactions as never, bids as never), repository, readiness, outbox, transactions, bids };
  }

  const run = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, work);

  it('replays conversion without a second project, outcome, conversion, or outbox event', async () => {
    const s = subject({ conversion: { projectId: 'project-a', cycleId: 'cycle-a', outcomeId: 'outcome-a', projectCode: 'ABC', projectName: 'Bid - ABC' } });
    await expect(run(() => s.service.win({ bidId: 'bid-a', idempotencyKey: 'same' }, actor()))).resolves.toMatchObject({ directProjectId: 'project-a' });
    expect(s.repository.convert).not.toHaveBeenCalled(); expect(s.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('replays reject without a second archive transition or outbox event', async () => {
    const s = subject({ archive: { outcomeId: 'outcome-a', cycleId: 'cycle-a' } });
    await expect(run(() => s.service.reject({ bidId: 'bid-a', idempotencyKey: 'same' }, actor()))).resolves.toEqual({ bidId: 'bid-a', outcomeId: 'outcome-a', cycleId: 'cycle-a' });
    expect(s.repository.archive).not.toHaveBeenCalled(); expect(s.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('replays archived review without another row or outbox event', async () => {
    const s = subject({ review: { id: 'review-a' } });
    await expect(run(() => s.service.requestArchivedReview({ bidId: 'bid-a', idempotencyKey: 'same' }, actor()))).resolves.toEqual({ bidId: 'bid-a', reviewRequestId: 'review-a', cycleId: null, outcomeId: null });
    expect(s.repository.requestReview).not.toHaveBeenCalled(); expect(s.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('replays restore without another cycle, status event, or outbox event', async () => {
    const s = subject({ restore: { id: 'cycle-2', cycleNumber: 2 } });
    await expect(run(() => s.service.restore({ bidId: 'bid-a', idempotencyKey: 'same' }, actor()))).resolves.toEqual({ bidId: 'bid-a', cycleId: 'cycle-2', cycleNumber: 2, outcomeId: null });
    expect(s.repository.restore).not.toHaveBeenCalled(); expect(s.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('denies a missing frozen permission before any C3 transaction', async () => {
    const s = subject();
    await expect(run(() => s.service.win({ bidId: 'bid-a' }, actor([])))).rejects.toMatchObject({ status: 403 });
    expect(s.transactions.execute).not.toHaveBeenCalled();
  });
});
