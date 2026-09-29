import {
  BidService,
  bidFileName,
  bidProjectCode,
  normalizeShipment,
} from './bid.service';

describe('Bid naming', () => {
  it('derives the owner-approved project code and normalizes shipment', () => {
    expect(bidProjectCode(' Salina ', 'Korea', 'Mexico')).toBe('SKM');
    expect(normalizeShipment('1')).toBe('01');
  });

  it('keeps the original filename in a repeated-document-code business name', () => {
    expect(
      bidFileName({
        biddingNumber: '21128',
        projectCode: 'SKM',
        cargoCode: 'CRA',
        vesselCode: 'CA2',
        shipmentNumber: '01',
        documentCode: '100',
        originalFileName: 'stowage-plan-detail-1.pdf',
      }),
    ).toBe('21128 SKM-CRA-CA2-01-100-A stowage-plan-detail-1.pdf');
  });

  it('returns the latest ordered Bid status event as the current status', async () => {
    const service = new BidService(
      {
        find: jest.fn().mockResolvedValue({
          id: 'bid-a',
          name: 'Bluewater Bid',
          projectCode: 'BBP',
          biddingNumber: '100',
          shipmentNumber: '01',
          clientId: 'client-a',
          client: { id: 'client-a', name: 'Bluewater Marine Logistics' },
          statusEvents: [{ toStatus: { code: 'BIDDING' } }],
          documents: [],
          _count: { documents: 0 },
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.findOne('bid-a')).resolves.toEqual(
      expect.objectContaining({ status: 'BIDDING' }),
    );
  });
});
