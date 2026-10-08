import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import {
  DocumentGroupCode,
  OptionTypeCode,
  Prisma,
} from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { NewDocumentDraft } from '../../common/documents/document-upload.pipeline';
import type { NewDocumentVersionDraft } from '../../common/documents/document-upload.pipeline';
import type { SessionActor } from '../../common/security/session.types';
import { relatedWorkRequestVisibilityWhere } from '../../common/security/work-request-visibility';

const select = {
  id: true,
  name: true,
  clientId: true,
  shipmentNumber: true,
  projectCode: true,
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
  versionId: string;
  documentCodeId: string;
  documentCodeSnapshot: string;
  documentNameSnapshot: string;
  originalFileName: string;
  generatedFileName: string | null;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
}
type ReferenceSnapshot = {
  clientId: string;
  polName: string;
  podName: string;
  cargoCode: string;
  vesselCode: string;
  documentCodes: Map<string, { code: string; name: string }>;
};

/** Tenant-scoped persistence adapter for the independent Project aggregate. */
@Injectable()
export class ProjectRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  prepareCreate(input: {
    clientId: string;
    polId: string;
    podId: string;
    cargoId: string;
    vesselId: string;
    documentCodeIds: string[];
  }): Promise<ReferenceSnapshot> {
    return this.transaction((db) => this.references(db, input));
  }
  async create(input: {
    id: string;
    name: string;
    normalizedName: string;
    clientId: string;
    polId: string;
    podId: string;
    cargoId: string;
    vesselId: string;
    projectCode: string;
    shipmentNumber: string;
    actorId: string;
    files: ProjectFileInput[];
    snapshots: Omit<ReferenceSnapshot, 'clientId' | 'documentCodes'>;
  }): Promise<ProjectRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await this.references(db, {
        clientId: input.clientId,
        polId: input.polId,
        podId: input.podId,
        cargoId: input.cargoId,
        vesselId: input.vesselId,
        documentCodeIds: input.files.map((file) => file.documentCodeId),
      });
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
          polId: input.polId,
          podId: input.podId,
          cargoId: input.cargoId,
          vesselId: input.vesselId,
          projectCode: input.projectCode,
          polNameSnapshot: input.snapshots.polName,
          podNameSnapshot: input.snapshots.podName,
          cargoCodeSnapshot: input.snapshots.cargoCode,
          vesselCodeSnapshot: input.snapshots.vesselCode,
          shipmentNumber: input.shipmentNumber,
          createdByActorId: input.actorId,
          documents: {
            create: input.files.map(
              ({
                id,
                versionId,
                documentCodeId,
                documentCodeSnapshot,
                documentNameSnapshot,
                originalFileName,
                generatedFileName,
                storageKey,
                mimeType,
                fileSizeBytes,
              }) => ({
                id,
                documentCodeId,
                documentCodeSnapshot,
                documentNameSnapshot,
                originalFileName,
                generatedFileName,
                storageKey,
                mimeType,
                fileSizeBytes,
                revisionCode: 'A',
                uploadedByActorId: input.actorId,
                versions: {
                  create: {
                    id: versionId,
                    versionNumber: 1,
                    originalFileName,
                    uploadedFileName: originalFileName,
                    generatedFileName,
                    storageKey,
                    mimeType,
                    fileSizeBytes,
                    revisionCode: 'A',
                    uploadedByActorId: input.actorId,
                  },
                },
              }),
            ),
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
  list(args: { skip: number; take: number }, actor?: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    const related = actor ? relatedWorkRequestVisibilityWhere(actor) : undefined;
    return this.transaction((db) =>
      db.directProject.findMany({
        where: { tenantId, ...(related ? { workRequestsV1: { some: related } } : {}) },
        skip: args.skip,
        take: args.take,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select,
      }),
    );
  }
  count(actor?: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    const related = actor ? relatedWorkRequestVisibilityWhere(actor) : undefined;
    return this.transaction((db) =>
      db.directProject.count({ where: { tenantId, ...(related ? { workRequestsV1: { some: related } } : {}) } }),
    );
  }
  find(id: string, actor?: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    const related = actor ? relatedWorkRequestVisibilityWhere(actor) : undefined;
    return this.transaction((db) =>
      db.directProject.findFirst({ where: { id, tenantId, ...(related ? { workRequestsV1: { some: related } } : {}) }, select }),
    );
  }
  async prepareStandaloneDocuments(
    projectId: string,
    documentCodeIds: string[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const project = await db.directProject.findFirst({
        where: { id: projectId, tenantId },
        select: {
          id: true,
          clientId: true,
          projectCode: true,
          cargoCodeSnapshot: true,
          vesselCodeSnapshot: true,
          shipmentNumber: true,
        },
      });
      if (!project) return null;
      if (
        !project.projectCode ||
        !project.cargoCodeSnapshot ||
        !project.vesselCodeSnapshot ||
        !project.shipmentNumber
      )
        throw new Error('PROJECT_NAMING_CONTEXT');
      const codes = await db.documentCodeOption.findMany({
        where: {
          id: { in: documentCodeIds },
          tenantId,
          isActive: true,
          documentGroup: DocumentGroupCode.MARKETING,
        },
        select: { id: true, code: true, name: true },
      });
      if (codes.length !== new Set(documentCodeIds).size)
        throw new Error('PROJECT_DOCUMENT_CODE');
      return {
        project,
        codes: new Map(
          codes.map((code) => [code.id, { code: code.code, name: code.name }]),
        ),
      };
    });
  }
  createStandaloneDocuments(
    projectId: string,
    actorId: string,
    files: NewDocumentDraft[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const project = await db.directProject.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true },
      });
      if (!project) return null;
      for (const file of files)
        await db.directProjectDocument.create({
          data: {
            id: file.documentId,
            tenantId,
            directProjectId: projectId,
            documentCodeId: file.documentCodeId,
            documentCodeSnapshot: file.documentCode,
            documentNameSnapshot: file.documentName,
            originalFileName: file.originalFileName,
            generatedFileName: file.generatedFileName,
            storageKey: file.storageKey,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            revisionCode: file.revisionCode,
            uploadedByActorId: actorId,
            versions: {
              create: {
                id: file.versionId,
                versionNumber: 1,
                originalFileName: file.originalFileName,
                uploadedFileName: file.uploadedFileName,
                generatedFileName: file.generatedFileName,
                storageKey: file.storageKey,
                mimeType: file.mimeType,
                fileSizeBytes: file.fileSizeBytes,
                revisionCode: file.revisionCode,
                uploadedByActorId: actorId,
              },
            },
          },
        });
      return db.directProjectDocument.findMany({
        where: { tenantId, id: { in: files.map((file) => file.documentId) } },
        select: documentSummarySelect,
      });
    });
  }
  prepareDocumentVersion(projectId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.directProjectDocument.findFirst({
        where: { id: documentId, directProjectId: projectId, tenantId },
        select: {
          id: true,
          directProjectId: true,
          documentCodeId: true,
          documentCodeSnapshot: true,
          documentNameSnapshot: true,
          originalFileName: true,
          revisionCode: true,
          directProject: {
            select: {
              clientId: true,
              projectCode: true,
              cargoCodeSnapshot: true,
              vesselCodeSnapshot: true,
              shipmentNumber: true,
            },
          },
        },
      }),
    );
  }
  appendDocumentVersion(
    projectId: string,
    documentId: string,
    actorId: string,
    file: NewDocumentVersionDraft,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.directProjectDocument.findFirst({
        where: { id: documentId, directProjectId: projectId, tenantId },
        select: {
          id: true,
          originalFileName: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true },
          },
        },
      });
      if (!document) return null;
      return db.directProjectDocumentVersion.create({
        data: {
          id: file.versionId,
          tenantId,
          directProjectDocumentId: document.id,
          versionNumber: (document.versions[0]?.versionNumber ?? 0) + 1,
          originalFileName: document.originalFileName,
          uploadedFileName: file.uploadedFileName,
          generatedFileName: file.generatedFileName,
          storageKey: file.storageKey,
          mimeType: file.mimeType,
          fileSizeBytes: file.fileSizeBytes,
          revisionCode: file.revisionCode,
          uploadedByActorId: actorId,
        },
        select: versionSelect,
      });
    });
  }
  documents(projectId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.directProjectDocument.findMany({
        where: { directProjectId: projectId, tenantId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: documentSummarySelect,
      }),
    );
  }
  documentVersions(projectId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.directProjectDocument.findFirst({
        where: { id: documentId, directProjectId: projectId, tenantId },
        select: { id: true },
      });
      if (!document) return null;
      return db.directProjectDocumentVersion.findMany({
        where: { tenantId, directProjectDocumentId: document.id },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        select: versionSelect,
      });
    });
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
        select: { id: true, code: true, name: true },
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
          documentNameSnapshot: target.name,
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

  private async references(
    db: PrismaExecutor,
    input: {
      clientId: string;
      polId: string;
      podId: string;
      cargoId: string;
      vesselId: string;
      documentCodeIds: string[];
    },
  ): Promise<ReferenceSnapshot> {
    const tenantId = RequestContext.requireTenantId();
    const client = await db.client.findFirst({
      where: { id: input.clientId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!client) throw new Error('PROJECT_CLIENT');
    const requested = new Map<OptionTypeCode, string>([
      [OptionTypeCode.POL, input.polId],
      [OptionTypeCode.POD, input.podId],
      [OptionTypeCode.CARGO_CODE, input.cargoId],
      [OptionTypeCode.VESSEL_CODE, input.vesselId],
    ]);
    const options = await db.optionValue.findMany({
      where: {
        tenantId,
        isActive: true,
        id: { in: [...requested.values()] },
        optionType: { code: { in: [...requested.keys()] } },
      },
      select: {
        id: true,
        name: true,
        code: true,
        optionType: { select: { code: true } },
      },
    });
    const byType = new Map(options.map((item) => [item.optionType.code, item]));
    if (
      byType.size !== requested.size ||
      [...requested.entries()].some(([type, id]) => byType.get(type)?.id !== id)
    )
      throw new Error('PROJECT_REFERENCE_OPTION');
    const documentCodes = await db.documentCodeOption.findMany({
      where: {
        id: { in: input.documentCodeIds },
        tenantId,
        isActive: true,
        documentGroup: DocumentGroupCode.MARKETING,
      },
      select: { id: true, code: true, name: true },
    });
    if (documentCodes.length !== new Set(input.documentCodeIds).size)
      throw new Error('PROJECT_DOCUMENT_CODE');
    const cargo = byType.get(OptionTypeCode.CARGO_CODE);
    const vessel = byType.get(OptionTypeCode.VESSEL_CODE);
    if (!cargo?.code || !vessel?.code)
      throw new Error('PROJECT_REFERENCE_OPTION');
    return {
      clientId: client.id,
      polName: byType.get(OptionTypeCode.POL)!.name,
      podName: byType.get(OptionTypeCode.POD)!.name,
      cargoCode: cargo.code,
      vesselCode: vessel.code,
      documentCodes: new Map(
        documentCodes.map((row) => [
          row.id,
          { code: row.code, name: row.name },
        ]),
      ),
    };
  }
}
const documentSummarySelect = {
  id: true,
  directProjectId: true,
  documentCodeId: true,
  documentCodeSnapshot: true,
  documentNameSnapshot: true,
  originalFileName: true,
  versions: {
    take: 1,
    orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      versionNumber: true,
      revisionCode: true,
      uploadedFileName: true,
      generatedFileName: true,
      mimeType: true,
      fileSizeBytes: true,
      uploadedAt: true,
      uploadedByActor: { select: { id: true, label: true } },
    },
  },
} satisfies Prisma.DirectProjectDocumentSelect;
const versionSelect = {
  id: true,
  versionNumber: true,
  revisionCode: true,
  uploadedFileName: true,
  generatedFileName: true,
  mimeType: true,
  fileSizeBytes: true,
  uploadedAt: true,
  uploadedByActor: { select: { id: true, label: true } },
} satisfies Prisma.DirectProjectDocumentVersionSelect;
