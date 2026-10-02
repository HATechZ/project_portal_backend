import { toWorkRequestResponse } from './work-request-response.mapper';

const baseRecord = {
  id: 'work-request-id',
  bidId: null,
  directProjectId: 'project-id',
  title: 'Request',
  priority: 'High',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByActor: { id: 'actor-id', label: 'Actor' },
  events: [],
  documents: [],
  assignments: [],
  infoRequests: [],
};

describe('toWorkRequestResponse shipment number', () => {
  it('derives shipmentNumber from a Bid parent', () => {
    const result = toWorkRequestResponse({
      ...baseRecord,
      bidId: 'bid-id',
      bid: {
        clientId: 'client-id',
        shipmentNumber: '01',
        client: { companyId: 'company-id' },
      },
      directProject: null,
    } as never);

    expect(result.shipmentNumber).toBe('01');
  });

  it('derives shipmentNumber from a Direct Project parent', () => {
    const result = toWorkRequestResponse({
      ...baseRecord,
      bid: null,
      directProject: {
        clientId: 'client-id',
        shipmentNumber: '02',
        client: { companyId: 'company-id' },
      },
    } as never);

    expect(result.shipmentNumber).toBe('02');
  });
});
