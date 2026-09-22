import { bidFileName, bidProjectCode, normalizeShipment } from './bid.service';

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
});
