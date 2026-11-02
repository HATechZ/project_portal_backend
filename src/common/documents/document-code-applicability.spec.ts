import {
  applicableDocumentCodeWhere,
  bidProjectDocumentGroups,
  workRequestDocumentGroups,
} from './document-code-applicability';
import { DocumentGroupCode } from '../../generated/prisma/client';

describe('document code applicability policy', () => {
  it('limits Bid and Project selection to GENERAL and MARKETING', () => {
    expect(bidProjectDocumentGroups()).toEqual([
      DocumentGroupCode.GENERAL,
      DocumentGroupCode.MARKETING,
    ]);
  });

  it('keeps GENERAL implicit and adds only the execution Division groups', () => {
    expect(
      workRequestDocumentGroups([
        DocumentGroupCode.GENERAL,
        DocumentGroupCode.ENGINEERING,
      ]),
    ).toEqual([DocumentGroupCode.GENERAL, DocumentGroupCode.ENGINEERING]);
  });

  it('always constrains selectors and validation to the active tenant and active codes', () => {
    expect(
      applicableDocumentCodeWhere('tenant-a', bidProjectDocumentGroups()),
    ).toMatchObject({ tenantId: 'tenant-a', isActive: true });
  });
});
