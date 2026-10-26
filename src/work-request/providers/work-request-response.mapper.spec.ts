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

  it('returns persisted document metadata and the latest version timestamp', () => {
    const uploadedAt = new Date('2026-10-26T00:00:00.000Z');
    const result = toWorkRequestResponse({
      ...baseRecord,
      bid: null,
      directProject: {
        clientId: 'client-id',
        shipmentNumber: '02',
        client: { companyId: 'company-id' },
      },
      documents: [
        {
          id: 'document-id',
          documentCodeId: 'code-id',
          documentCodeSnapshot: 'DOC',
          originalFileName: 'plan.pdf',
          description: 'Main plan',
          shipmentNumber: 'S-001',
          generatedFileName: 'generated.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1n,
          versions: [{ uploadedAt }],
        },
      ],
    } as never);

    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        description: 'Main plan',
        shipmentNumber: 'S-001',
        lastUpdatedAt: uploadedAt,
      }),
    );
  });
});
