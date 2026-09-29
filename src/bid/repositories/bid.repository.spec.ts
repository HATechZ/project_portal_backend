import { RequestContext } from '../../common/context/request-context';
import { BidRepository } from './bid.repository';

const tenantId = 'tenant-a';

describe('BidRepository lifecycle foundation', () => {
  it('persists the initial BIDDING event with the Bid in the tenant transaction', async () => {
    let bidCreateInput: { data: { tenantId: string } } | undefined;
    let statusEventInput:
      | {
          data: {
            tenantId: string;
            bidId: string;
            toStatusId: string;
            changedByActorId: string;
          };
        }
      | undefined;
    const bidCreate = (input: { data: { tenantId: string } }) => {
      bidCreateInput = input;
      return Promise.resolve({});
    };
    const statusEventCreate = (input: {
      data: {
        tenantId: string;
        bidId: string;
        toStatusId: string;
        changedByActorId: string;
      };
    }) => {
      statusEventInput = input;
      return Promise.resolve({});
    };
    const repository = new BidRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          client: {
            findFirst: jest.fn().mockResolvedValue({ id: 'client-a' }),
          },
          optionValue: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'pol-a',
                name: 'Port A',
                code: null,
                optionType: { code: 'POL' },
              },
              {
                id: 'pod-a',
                name: 'Port B',
                code: null,
                optionType: { code: 'POD' },
              },
              {
                id: 'cargo-a',
                name: 'Cargo',
                code: 'CG',
                optionType: { code: 'CARGO_CODE' },
              },
              {
                id: 'vessel-a',
                name: 'Vessel',
                code: 'VS',
                optionType: { code: 'VESSEL_CODE' },
              },
            ]),
          },
          documentCodeOption: { findMany: jest.fn().mockResolvedValue([]) },
          bidStatus: {
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue({ id: 'bidding-status' }),
          },
          bid: {
            create: bidCreate,
            findFirstOrThrow: jest.fn().mockResolvedValue({}),
          },
          businessNameClaim: { create: jest.fn().mockResolvedValue({}) },
          bidStatusEvent: { create: statusEventCreate },
          bidDocument: { createMany: jest.fn() },
          bidDocumentVersion: { createMany: jest.fn() },
        }),
    } as never);

    await RequestContext.run({ requestId: 'request-a', tenantId }, () =>
      repository.create({
        id: 'bid-a',
        clientId: 'client-a',
        name: 'Bluewater Bid',
        normalizedName: 'bluewater bid',
        projectCode: 'BBP',
        biddingNumber: '100',
        shipmentNumber: '01',
        polId: 'pol-a',
        podId: 'pod-a',
        cargoId: 'cargo-a',
        vesselId: 'vessel-a',
        actorId: 'actor-a',
        files: [],
        snapshots: {
          polName: 'Port A',
          podName: 'Port B',
          cargoCode: 'CG',
          vesselCode: 'VS',
        },
      }),
    );

    expect(bidCreateInput).toMatchObject({ data: { tenantId } });
    expect(statusEventInput).toMatchObject({
      data: {
        tenantId,
        bidId: 'bid-a',
        toStatusId: 'bidding-status',
        changedByActorId: 'actor-a',
      },
    });
  });

  it('uses a tenant-qualified latest-event query so Bid status history is reconstructable', async () => {
    let findInput: unknown;
    const findFirst = (input: unknown) => {
      findInput = input;
      return Promise.resolve(null);
    };
    const repository = new BidRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ bid: { findFirst } }),
    } as never);

    await RequestContext.run({ requestId: 'request-a', tenantId }, () =>
      repository.find('bid-a'),
    );

    expect(findInput).toMatchObject({
      where: { id: 'bid-a', tenantId },
      select: {
        statusEvents: {
          take: 1,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
  });
});
