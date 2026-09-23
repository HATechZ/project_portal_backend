import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { DocumentGroupCode, Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

const select = {
  id: true,
  name: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
  statusEvents: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { toStatus: { select: { code: true } } },
  },
  documents: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      documentCodeId: true,
      originalFileName: true,
      generatedFileName: true,
      storageKey: true,
      mimeType: true,
      fileSizeBytes: true,
    },
  },
  _count: { select: { documents: true } },
} satisfies Prisma.DirectProjectSelect;
export type ProjectRecord = Prisma.DirectProjectGetPayload<{
  select: typeof select;
}>;
export interface ProjectFileInput {
  id: string;
  documentCodeId: string;
  documentCodeSnapshot: string;
  originalFileName: string;
  generatedFileName: string | null;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
}

/** Tenant-scoped persistence adapter for the independent Project aggregate. */
@Injectable()
export class ProjectRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  async create(input: {
    id: string;
    name: string;
    normalizedName: string;
    clientId: string;
    actorId: string;
    files: ProjectFileInput[];
  }): Promise<ProjectRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const client = await db.client.findFirst({
        where: { id: input.clientId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!client) throw new Error('PROJECT_CLIENT');
      const status = await db.directProjectStatus.findUniqueOrThrow({
        where: { code: 'ACTIVE' },
        select: { id: true },
      });
      await db.directProject.create({
        data: {
          id: input.id,
          tenantId,
          name: input.name,
          clientId: input.clientId,
          createdByActorId: input.actorId,
          documents: {
            create: input.files.map((file) => ({
              ...file,
              revisionCode: 'A',
              uploadedByActorId: input.actorId,
              versions: {
                create: {
                  id: randomUUID(),
                  tenantId,
                  versionNumber: 1,
                  originalFileName: file.originalFileName,
                  generatedFileName: file.generatedFileName,
                  storageKey: file.storageKey,
                  mimeType: file.mimeType,
                  fileSizeBytes: file.fileSizeBytes,
                  revisionCode: 'A',
                  uploadedByActorId: input.actorId,
                },
              },
            })),
          },
        },
      });
      await db.businessNameClaim.create({
        data: {
          id: randomUUID(),
          tenantId,
          normalizedName: input.normalizedName,
          directProjectId: input.id,
        },
      });
      await db.directProjectStatusEvent.create({
        data: {
          id: randomUUID(),
          tenantId,
          directProjectId: input.id,
          toStatusId: status.id,
          changedByActorId: input.actorId,
        },
      });
      return db.directProject.findFirstOrThrow({
        where: { id: input.id, tenantId },
        select,
      });
    });
  }
  list(args: { skip: number; take: number }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.directProject.findMany({
        where: { tenantId },
        skip: args.skip,
        take: args.take,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select,
      }),
    );
  }
  count() {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.directProject.count({ where: { tenantId } }),
    );
  }
  find(id: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.directProject.findFirst({ where: { id, tenantId }, select }),
    );
  }
  async rename(
    id: string,
    name: string,
    normalizedName: string,
  ): Promise<ProjectRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const current = await db.directProject.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!current) return null;
      await db.businessNameClaim.update({
        where: { directProjectId_tenantId: { directProjectId: id, tenantId } },
        data: { normalizedName, updatedAt: new Date() },
      });
      await db.directProject.update({
        where: { id },
        data: { name, updatedAt: new Date() },
      });
      return db.directProject.findFirst({ where: { id, tenantId }, select });
    });
  }

  async reclassifyDocument(input: {
    projectId: string;
    documentId: string;
    documentCodeId: string;
    actorId: string;
  }): Promise<{
    id: string;
    originalFileName: string;
    storageKey: string;
    generatedFileName: string | null;
    documentCodeId: string;
  } | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.directProjectDocument.findFirst({
        where: {
          id: input.documentId,
          directProjectId: input.projectId,
          tenantId,
        },
        select: {
          id: true,
          documentCodeId: true,
          documentCodeSnapshot: true,
          originalFileName: true,
          generatedFileName: true,
          storageKey: true,
        },
      });
      if (!document) return null;
      const target = await db.documentCodeOption.findFirst({
        where: {
          id: input.documentCodeId,
          tenantId,
          isActive: true,
          documentGroup: DocumentGroupCode.MARKETING,
        },
        select: { id: true, code: true },
      });
      if (!target) throw new Error('PROJECT_DOCUMENT_CODE');
      // Project has no owner-defined naming code yet. Null is intentional until a
      // later Project document workflow supplies sufficient naming components.
      const generatedFileName = document.generatedFileName;
      await db.directProjectDocument.update({
        where: { id: document.id },
        data: {
          documentCodeId: target.id,
          documentCodeSnapshot: target.code,
          generatedFileName,
          updatedAt: new Date(),
        },
      });
      await db.directProjectDocumentClassificationEvent.create({
        data: {
          id: randomUUID(),
          tenantId,
          directProjectDocumentId: document.id,
          fromDocumentCodeId: document.documentCodeId,
          toDocumentCodeId: target.id,
          fromDocumentCodeSnapshot: document.documentCodeSnapshot,
          toDocumentCodeSnapshot: target.code,
          fromGeneratedFileName: document.generatedFileName,
          toGeneratedFileName: generatedFileName,
          changedByActorId: input.actorId,
        },
      });
      return {
        id: document.id,
        originalFileName: document.originalFileName,
        storageKey: document.storageKey,
        generatedFileName,
        documentCodeId: target.id,
      };
    });
  }

  async documentCodes(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const rows = await db.documentCodeOption.findMany({
        where: {
          id: { in: ids },
          tenantId,
          isActive: true,
          documentGroup: DocumentGroupCode.MARKETING,
        },
        select: { id: true, code: true },
      });
      if (rows.length !== new Set(ids).size)
        throw new Error('PROJECT_DOCUMENT_CODE');
      return new Map(rows.map((row) => [row.id, row.code]));
    });
  }
}
