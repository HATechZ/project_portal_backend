import { RequestContext } from '../../common/context/request-context';
import { BidBusinessRepository } from './bid-business.repository';

describe('BidBusinessRepository C3 history', () => {
  const bid = {
    id: 'bid-a', name: 'Ocean Bid', clientId: 'client-a', polId: 'pol-a', podId: 'pod-a', cargoId: 'cargo-a', vesselId: 'vessel-a',
    polNameSnapshot: 'Korea', podNameSnapshot: 'Mexico', cargoCodeSnapshot: 'CAR', vesselCodeSnapshot: 'VES', shipmentNumber: '01',
    statusEvents: [{ toStatus: { code: 'BIDDING' } }],
  };
  function db() {
    return {
      bidProjectConversion: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      bid: { findFirstOrThrow: jest.fn().mockResolvedValue(bid), findFirst: jest.fn().mockResolvedValue({ statusEvents: [{ toStatusId: 'bidding' }] }) },
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-a' }) },
      optionValue: { findMany: jest.fn().mockResolvedValue([
        { id: 'pol-a', optionType: { code: 'POL' } }, { id: 'pod-a', optionType: { code: 'POD' } },
        { id: 'cargo-a', optionType: { code: 'CARGO_CODE' } }, { id: 'vessel-a', optionType: { code: 'VESSEL_CODE' } },
      ]) },
      directProjectStatus: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'active' }) },
      directProject: { create: jest.fn().mockResolvedValue({}) },
      businessNameClaim: { create: jest.fn().mockResolvedValue({}) },
      directProjectStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      bidBusinessOutcome: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn(), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'outcome-a' }) },
      bidBusinessCycle: { update: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      bidStatus: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'archived' }) },
      bidStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      bidArchivedReviewRequest: { findFirstOrThrow: jest.fn().mockResolvedValue({ rejectedOutcomeId: 'outcome-a' }), create: jest.fn().mockResolvedValue({}) },
    };
  }
  const run = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, work);

  it('creates an independent, canonically named DirectProject and immutable provenance without touching Bid children', async () => {
    const client = db(); const repository = new BidBusinessRepository({ client } as never);
    const result = await run(() => repository.convert({ bidId: 'bid-a', actorId: 'actor-a', idempotencyKey: 'convert-a', readiness: { ready: true, cycleId: 'cycle-a', total: 1, accepted: 1, blocking: [] } }));
    expect(result.projectId).not.toBe('bid-a');
    expect(client.directProject.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Ocean Bid - OKM', projectCode: 'OKM', createdByActorId: 'actor-a' }) }));
    expect(client.businessNameClaim.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ normalizedName: 'ocean bid - okm' }) }));
    expect(client.bidProjectConversion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId: 'bid-a', directProjectId: result.projectId, businessCycleId: 'cycle-a' }) }));
    expect(client.bidBusinessCycle.update).toHaveBeenCalledWith(expect.objectContaining({ data: { closedAt: expect.any(Date) } }));
    expect((client as Record<string, unknown>).workRequestV1).toBeUndefined();
    expect((client as Record<string, unknown>).bidDocument).toBeUndefined();
  });

  it('archives by appending outcome/status history and does not update Work Requests or documents', async () => {
    const client = db(); const repository = new BidBusinessRepository({ client } as never);
    await run(() => repository.archive({ bidId: 'bid-a', actorId: 'actor-a', idempotencyKey: 'reject-a', readiness: { ready: true, cycleId: 'cycle-a', total: 1, accepted: 1, blocking: [] } }));
    expect(client.bidBusinessOutcome.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId: 'bid-a', businessCycleId: 'cycle-a', idempotencyKey: 'reject-a' }) }));
    expect(client.bidStatusEvent.create).toHaveBeenCalled();
    expect((client as Record<string, unknown>).workRequestV1).toBeUndefined();
    expect((client as Record<string, unknown>).bidDocument).toBeUndefined();
  });

  it('records a tenant-scoped archived review request without restoring the Bid', async () => {
    const client = db();
    const repository = new BidBusinessRepository({ client } as never);
    await run(() => repository.requestReview({ bidId: 'bid-a', actorId: 'actor-a', idempotencyKey: 'review-a' }));
    expect(client.bidArchivedReviewRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId: 'bid-a', rejectedOutcomeId: 'outcome-a', idempotencyKey: 'review-a' }) }));
    expect(client.bidStatusEvent.create).not.toHaveBeenCalled();
  });

  it('restores the same Bid into the next empty cycle and leaves old Work Requests untouched', async () => {
    const client = db(); client.bidBusinessCycle.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ cycleNumber: 1 });
    const repository = new BidBusinessRepository({ client } as never);
    const result = await run(() => repository.restore({ bidId: 'bid-a', actorId: 'actor-a', idempotencyKey: 'restore-a' }));
    expect(result.cycleNumber).toBe(2);
    expect(client.bidBusinessCycle.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId: 'bid-a', cycleNumber: 2, idempotencyKey: 'restore-a', reopenedFromOutcomeId: 'outcome-a' }) }));
    expect((client as Record<string, unknown>).workRequestV1).toBeUndefined();
  });
});
