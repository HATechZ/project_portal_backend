import { WorkRequestV1StateCode } from '../../generated/prisma/client';
import { allowsWorkRequestDocumentVersion } from './work-request-service-base';

describe('Work Request document version state policy', () => {
  it('permits only an assigned Member, including after a return', () => {
    expect(
      allowsWorkRequestDocumentVersion(WorkRequestV1StateCode.MEMBER_ASSIGNED),
    ).toBe(true);
  });

  it('locks uploads once the Member has submitted', () => {
    expect(
      allowsWorkRequestDocumentVersion(WorkRequestV1StateCode.MEMBER_SUBMITTED),
    ).toBe(false);
  });
});
