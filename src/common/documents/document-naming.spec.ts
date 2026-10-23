import {
  deriveProjectCode,
  formatDirectProjectDocumentFileName,
  initialDocumentVersionMetadata,
  nextDocumentVersionMetadata,
  nextBidRevisionCode,
  nextProjectRevisionCode,
} from './document-naming';

describe('shared document naming foundation', () => {
  it('derives Direct Project code and uses the Document Code name, not uploaded base name', () => {
    expect(deriveProjectCode(' Salina ', 'Korea', 'Mexico')).toBe('SKM');
    expect(
      formatDirectProjectDocumentFileName({
        projectCode: 'SKM',
        cargoCode: 'CRA',
        vesselCode: 'CA2',
        shipmentNumber: '01',
        documentCode: '100',
        documentName: 'Stowage Plan',
        revisionCode: 'A',
        uploadedFileName: '../final_plan_v7.pdf',
      }),
    ).toBe('SKM-CRA-CA2-01-100-A Stowage Plan.pdf');
  });

  it('keeps source metadata and separates version number from workflow revision', () => {
    expect(
      initialDocumentVersionMetadata({
        uploadedFileName: '../final_plan_v7.pdf',
        revisionCode: 'A',
      }),
    ).toEqual({
      originalFileName: 'final_plan_v7.pdf',
      uploadedFileName: 'final_plan_v7.pdf',
      versionNumber: 1,
      revisionCode: 'A',
    });
    expect(
      nextDocumentVersionMetadata({
        uploadedFileName: 'working.pdf',
        nextVersionNumber: 2,
        revisionCode: 'A',
      }),
    ).toEqual({
      uploadedFileName: 'working.pdf',
      versionNumber: 2,
      revisionCode: 'A',
    });
  });

  it('normalizes user and code display names to Unicode NFC', () => {
    expect(
      formatDirectProjectDocumentFileName({
        projectCode: 'SKM',
        cargoCode: 'CRA',
        vesselCode: 'CA2',
        shipmentNumber: '01',
        documentCode: '100',
        documentName: 'Cafe\u0301 Plan',
        revisionCode: 'A',
        uploadedFileName: 'Cafe\u0301.pdf',
      }),
    ).toBe('SKM-CRA-CA2-01-100-A Caf\u00e9 Plan.pdf');
  });

  it('preserves approved Project revision zero padding', () => {
    expect(
      formatDirectProjectDocumentFileName({
        projectCode: 'SKM',
        cargoCode: 'CRA',
        vesselCode: 'CA2',
        shipmentNumber: '01',
        documentCode: '100',
        documentName: 'Stowage Plan',
        revisionCode: '01',
        uploadedFileName: 'plan.pdf',
      }),
    ).toBe('SKM-CRA-CA2-01-100-01 Stowage Plan.pdf');
  });

  it('allocates Bid alphabetic and Project numeric revision sequences', () => {
    expect(nextBidRevisionCode()).toBe('A');
    expect(nextBidRevisionCode('Z')).toBe('AA');
    expect(nextBidRevisionCode('AZ')).toBe('BA');
    expect(nextProjectRevisionCode()).toBe('01');
    expect(nextProjectRevisionCode('01')).toBe('02');
    expect(nextProjectRevisionCode('99')).toBe('100');
  });
});
