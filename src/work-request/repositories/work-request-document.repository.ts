import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class WorkRequestDocumentRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  documents(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Document.findMany({
        where: { tenantId, workRequestId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          documentCodeId: true,
          documentCodeSnapshot: true,
          originalFileName: true,
          generatedFileName: true,
          mimeType: true,
          fileSizeBytes: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: {
              id: true,
              versionNumber: true,
              revisionCode: true,
              uploadedAt: true,
            },
          },
        },
      }),
    );
  }
  versions(workRequestId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.workRequestV1Document.findFirst({
        where: { id: documentId, workRequestId, tenantId },
        select: { id: true },
      });
      if (!document) return null;
      return db.workRequestV1DocumentVersion.findMany({
        where: { tenantId, workRequestV1DocumentId: document.id },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          versionNumber: true,
          revisionCode: true,
          originalFileName: true,
          generatedFileName: true,
          mimeType: true,
          fileSizeBytes: true,
          uploadedAt: true,
          uploadedByActor: { select: { id: true, label: true } },
        },
      });
    });
  }
}
