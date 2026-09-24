import { formatBidDocumentFileName } from '../../common/utils/bid-document-file-name';
import { WorkRequestNamingProvider } from './work-request-naming.provider';

describe('WorkRequestNamingProvider', () => {
  const provider = new WorkRequestNamingProvider();
  const bidNaming = {
    biddingNumber: '21128',
    projectCode: 'PERSISTED',
    cargoCode: 'CRA',
    vesselCode: 'CA2',
    shipmentNumber: '01',
  };
  it('uses persisted Bid snapshots and canonical initial revision naming', () => {
    const generated = provider.generatedFileName({
      bidNaming,
      documentCode: '100',
      revisionCode: 'A',
      originalFileName: 'stowage-plan.pdf',
    });
    expect(generated).toBe('21128 PERSISTED-CRA-CA2-01-100-A stowage-plan.pdf');
    expect(generated).toBe(
      formatBidDocumentFileName({
        ...bidNaming,
        documentCode: '100',
        revisionCode: 'A',
        originalFileName: 'stowage-plan.pdf',
      }),
    );
  });
  it('retains null generated names for Direct Project-backed Work Requests', () => {
    expect(
      provider.generatedFileName({
        bidNaming: null,
        documentCode: '100',
        revisionCode: 'A',
        originalFileName: 'plan.pdf',
      }),
    ).toBeNull();
  });
});
