import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import {
  SearchDocumentsQueryDto,
  TreeQueryDto,
} from './document-management-query.dto';

const id = '11111111-1111-4111-8111-111111111111';

describe('Documents 10.2 query DTOs', () => {
  it('accepts every contracted search filter and pagination/sort control', async () => {
    const dto = plainToInstance(SearchDocumentsQueryDto, {
      q: 'NFC query',
      parentKind: 'BID',
      parentId: id,
      workRequestId: id,
      documentCodeId: id,
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-01-31T23:59:59.999Z',
      revisionCode: 'A',
      versionNumber: '2',
      mimeType: 'application/pdf',
      uploaderId: id,
      mode: 'exact',
      cursor: 'opaque-cursor',
      limit: '100',
      sort: 'uploadedAt:desc',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.versionNumber).toBe(2);
    expect(dto.limit).toBe(100);
  });

  it('rejects invalid filters and out-of-range pagination while accepting lazy tree input', async () => {
    await expect(
      validate(
        plainToInstance(SearchDocumentsQueryDto, {
          parentKind: 'WORK_REQUEST',
          parentId: 'not-a-uuid',
          versionNumber: 0,
          mode: 'all',
          limit: 101,
          sort: 'name:asc',
        }),
      ),
    ).resolves.toHaveLength(6);
    await expect(
      validate(
        plainToInstance(TreeQueryDto, {
          parentNodeId: 'opaque-node',
          cursor: 'opaque-cursor',
          limit: '1',
        }),
      ),
    ).resolves.toHaveLength(0);
  });
});
