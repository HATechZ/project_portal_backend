import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DocumentUploadOperationCode,
  DocumentUploadOwnerCode,
  AuditEntityTypeCode,
  Prisma,
} from '../../generated/prisma/client';
import { RequestContext } from '../context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Immutable x-request-id receipts for standalone document commands. */
@Injectable()
export class DocumentUploadRequestRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  find(input: {
    owner: DocumentUploadOwnerCode;
    parentId: string;
    targetId: string;
    operation: DocumentUploadOperationCode;
    requestId: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.documentUploadRequest.findUnique({
        where: {
          tenantId_owner_parentId_targetId_operation_requestId: {
            tenantId,
            ...input,
          },
        },
        select: { response: true },
      }),
    );
  }

  write(input: {
    owner: DocumentUploadOwnerCode;
    parentId: string;
    targetId: string;
    operation: DocumentUploadOperationCode;
    requestId: string;
    actorId: string;
    response: Prisma.InputJsonValue;
    audit: {
      entityId: string;
      summary: string;
      afterData: Prisma.InputJsonValue;
    };
  }) {
    return this.transaction(async (db) => {
      const tenantId = RequestContext.requireTenantId();
      await db.systemAuditLog.create({
        data: {
          tenantId,
          id: randomUUID(),
          entityType: AuditEntityTypeCode.DOCUMENT,
          entityId: input.audit.entityId,
          performedByActorId: input.actorId,
          summary: input.audit.summary,
          afterData: input.audit.afterData,
        },
      });
      return db.documentUploadRequest.create({
        data: {
          tenantId,
          id: randomUUID(),
          owner: input.owner,
          parentId: input.parentId,
          targetId: input.targetId,
          operation: input.operation,
          requestId: input.requestId,
          response: input.response,
          createdByActorId: input.actorId,
        },
      });
    });
  }
}
