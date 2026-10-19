import { RequestContext } from '../../common/context/request-context';
import { BidBusinessReadinessProvider } from './bid-business-readiness.provider';

describe('BidBusinessReadinessProvider', () => {
  function evaluate(cycle: { id: string } | null, states: Array<string | null>) {
    const provider = new BidBusinessReadinessProvider({
      client: {
        bidBusinessCycle: { findFirst: jest.fn().mockResolvedValue(cycle) },
        workRequestV1: {
          findMany: jest.fn().mockResolvedValue(
            states.map((state, index) => ({
              id: `wr-${index}`,
              events: state ? [{ resultingState: state }] : [],
            })),
          ),
        },
      },
    } as never);
    return RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.evaluate('bid-a'));
  }

  it('rejects a Bid without an open cycle', async () => {
    await expect(evaluate(null, [])).resolves.toMatchObject({ ready: false, blocking: ['NO_OPEN_CYCLE'] });
  });

  it('rejects a zero-member cycle', async () => {
    await expect(evaluate({ id: 'cycle-a' }, [])).resolves.toMatchObject({ ready: false, total: 0, blocking: ['ZERO_WORK_REQUESTS'] });
  });

  it.each(['CREATED', 'FINAL_RELEASE', 'CLIENT_REVIEW', 'REJECTED', 'CLIENT_REVISION_REQUESTED'])('treats %s as non-ready', async (state) => {
    await expect(evaluate({ id: 'cycle-a' }, [state])).resolves.toMatchObject({ ready: false, accepted: 0, blocking: ['wr-0'] });
  });

  it('requires every current-cycle request to be accepted', async () => {
    await expect(evaluate({ id: 'cycle-a' }, ['ACCEPTED', 'CLIENT_REVIEW'])).resolves.toMatchObject({ ready: false, total: 2, accepted: 1, blocking: ['wr-1'] });
  });

  it('is ready only when every current-cycle request is accepted', async () => {
    await expect(evaluate({ id: 'cycle-a' }, ['ACCEPTED', 'ACCEPTED'])).resolves.toMatchObject({ ready: true, total: 2, accepted: 2, blocking: [] });
  });

  it('queries only explicit current-cycle members, excluding old-cycle and legacy null-cycle rows', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const provider = new BidBusinessReadinessProvider({ client: { bidBusinessCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'current-cycle' }) }, workRequestV1: { findMany } } } as never);
    await RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.evaluate('bid-a'));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a', bidId: 'bid-a', bidBusinessCycleId: 'current-cycle' }, select: expect.objectContaining({ events: expect.objectContaining({ orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] }) }) }));
  });
});
