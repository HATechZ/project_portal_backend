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

const bidSelect = {
  id: true,
  name: true,
  projectCode: true,
  polNameSnapshot: true,
  podNameSnapshot: true,
  biddingNumber: true,
  shipmentNumber: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  statusEvents: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { toStatus: { select: { code: true } } },
  },
  documents: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      documentCodeId: true,
      originalFileName: true,
      generatedFileName: true,
      description: true,
      shipmentNumber: true,
      storageKey: true,
      mimeType: true,
      fileSizeBytes: true,
      versions: {
        take: 1,
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        select: {
          generatedFileName: true,
          mimeType: true,
          fileSizeBytes: true,
          uploadedAt: true,
        },
      },
    },
  },
  _count: { select: { documents: true } },
} satisfies Prisma.BidSelect;

export type BidRecord = Prisma.BidGetPayload<{ select: typeof bidSelect }>;

export interface BidFileInput {
  id: string;
  versionId: string;
  documentCodeId: string;
  documentCodeSnapshot: string;
  documentNameSnapshot: string;
  originalFileName: string;
  generatedFileName: string;
  description: string | null;
  shipmentNumber: string | null;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
}

interface ReferenceSnapshot {
  clientId: string;
  polName: string;
  podName: string;
  cargoCode: string;
  vesselCode: string;
  documentCodes: Map<string, { code: string; name: string }>;
}

@Injectable()
export class BidRepository extends BaseRepository {
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
    clientId: string;
    name: string;
    normalizedName: string;
    projectCode: string;
    biddingNumber: string;
    shipmentNumber: string;
    polId: string;
    podId: string;
    cargoId: string;
    vesselId: string;
    actorId: string;
    files: BidFileInput[];
    snapshots: Omit<ReferenceSnapshot, 'clientId' | 'documentCodes'>;
  }): Promise<BidRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        await this.references(db, {
          clientId: input.clientId,
          polId: input.polId,
          podId: input.podId,
          cargoId: input.cargoId,
          vesselId: input.vesselId,
          documentCodeIds: input.files.map(
            ({ documentCodeId }) => documentCodeId,
          ),
        });
        const status = await db.bidStatus.findUniqueOrThrow({
          where: { code: 'BIDDING' },
          select: { id: true },
        });
        await db.bid.create({
          data: {
            id: input.id,
            tenantId,
            clientId: input.clientId,
            name: input.name,
            projectCode: input.projectCode,
            biddingNumber: input.biddingNumber,
            shipmentNumber: input.shipmentNumber,
            polId: input.polId,
            podId: input.podId,
            cargoId: input.cargoId,
            vesselId: input.vesselId,
            polNameSnapshot: input.snapshots.polName,
            podNameSnapshot: input.snapshots.podName,
            cargoCodeSnapshot: input.snapshots.cargoCode,
            vesselCodeSnapshot: input.snapshots.vesselCode,
            createdByActorId: input.actorId,
          },
        });
        await db.businessNameClaim.create({
          data: {
            id: randomUUID(),
            tenantId,
            normalizedName: input.normalizedName,
            bidId: input.id,
          },
        });
        await db.bidStatusEvent.create({
          data: {
            id: randomUUID(),
            tenantId,
            bidId: input.id,
            toStatusId: status.id,
            changedByActorId: input.actorId,
          },
        });
        await db.bidBusinessCycle.create({
          data: {
            id: randomUUID(),
            tenantId,
            bidId: input.id,
            cycleNumber: 1,
            openedByActorId: input.actorId,
          },
        });
        if (input.files.length) {
          await db.bidDocument.createMany({
            data: input.files.map(
              ({
                id,
                documentCodeId,
                documentCodeSnapshot,
                documentNameSnapshot,
                originalFileName,
                generatedFileName,
                description,
                shipmentNumber,
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
                description,
                shipmentNumber,
                storageKey,
                mimeType,
                fileSizeBytes,
                tenantId,
                bidId: input.id,
                uploadedByActorId: input.actorId,
                revisionCode: 'A',
              }),
            ),
          });
          await db.bidDocumentVersion.createMany({
            data: input.files.map((file) => ({
              id: file.versionId,
              tenantId,
              bidDocumentId: file.id,
              versionNumber: 1,
              originalFileName: file.originalFileName,
              uploadedFileName: file.originalFileName,
              generatedFileName: file.generatedFileName,
              storageKey: file.storageKey,
              mimeType: file.mimeType,
              fileSizeBytes: file.fileSizeBytes,
              revisionCode: 'A',
              uploadedByActorId: input.actorId,
            })),
          });
        }
        return db.bid.findFirstOrThrow({
          where: { id: input.id, tenantId },
          select: bidSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  list(
    args: { skip: number; take: number },
    actor?: SessionActor,
  ): Promise<BidRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    const related = actor
      ? relatedWorkRequestVisibilityWhere(actor)
      : undefined;
    return this.transaction((db) =>
      db.bid.findMany({
        where: {
          tenantId,
          ...(related ? { workRequestsV1: { some: related } } : {}),
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        select: bidSelect,
      }),
    );
  }

  count(actor?: SessionActor): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    const related = actor
      ? relatedWorkRequestVisibilityWhere(actor)
      : undefined;
    return this.transaction((db) =>
      db.bid.count({
        where: {
          tenantId,
          ...(related ? { workRequestsV1: { some: related } } : {}),
        },
      }),
    );
  }

  find(id: string, actor?: SessionActor): Promise<BidRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    const related = actor
      ? relatedWorkRequestVisibilityWhere(actor)
      : undefined;
    return this.transaction((db) =>
      db.bid.findFirst({
        where: {
          id,
          tenantId,
          ...(related ? { workRequestsV1: { some: related } } : {}),
        },
        select: bidSelect,
      }),
    );
  }

  async prepareStandaloneDocuments(bidId: string, documentCodeIds: string[]) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const bid = await db.bid.findFirst({
        where: { id: bidId, tenantId },
        select: {
          id: true,
          clientId: true,
          biddingNumber: true,
          projectCode: true,
          cargoCodeSnapshot: true,
          vesselCodeSnapshot: true,
          shipmentNumber: true,
        },
      });
      if (!bid) return null;
      const codes = await db.documentCodeOption.findMany({
        where: {
          id: { in: documentCodeIds },
          tenantId,
          isActive: true,
          documentGroup: {
            in: [DocumentGroupCode.GENERAL, DocumentGroupCode.MARKETING],
          },
        },
        select: { id: true, code: true, name: true },
      });
      if (codes.length !== new Set(documentCodeIds).size)
        throw new Error('BID_REFERENCE_DOCUMENT_CODE');
      return {
        bid,
        codes: new Map(
          codes.map((code) => [code.id, { code: code.code, name: code.name }]),
        ),
      };
    });
  }

  createStandaloneDocuments(
    bidId: string,
    actorId: string,
    files: NewDocumentDraft[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const bid = await db.bid.findFirst({
        where: { id: bidId, tenantId },
        select: { id: true },
      });
      if (!bid) return null;
      for (const file of files) {
        await db.bidDocument.create({
          data: {
            id: file.documentId,
            tenantId,
            bidId,
            documentCodeId: file.documentCodeId,
            documentCodeSnapshot: file.documentCode,
            documentNameSnapshot: file.documentName,
            originalFileName: file.originalFileName,
            generatedFileName: file.generatedFileName,
            description: file.description,
            shipmentNumber: file.shipmentNumber,
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
      }
      return db.bidDocument.findMany({
        where: { tenantId, id: { in: files.map((file) => file.documentId) } },
        select: documentSummarySelect,
      });
    });
  }
  async prepareDocumentVersion(bidId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.bidDocument.findFirst({
        where: { id: documentId, bidId, tenantId },
        select: {
          id: true,
          bidId: true,
          documentCodeId: true,
          documentCodeSnapshot: true,
          documentNameSnapshot: true,
          originalFileName: true,
          revisionCode: true,
          bid: {
            select: {
              clientId: true,
              biddingNumber: true,
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
    bidId: string,
    documentId: string,
    actorId: string,
    file: NewDocumentVersionDraft,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.bidDocument.findFirst({
        where: { id: documentId, bidId, tenantId },
        select: {
          id: true,
          originalFileName: true,
          documentCodeId: true,
          documentCodeSnapshot: true,
          documentNameSnapshot: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true },
          },
        },
      });
      if (!document) return null;
      const versionNumber = (document.versions[0]?.versionNumber ?? 0) + 1;
      const created = await db.bidDocumentVersion.create({
        data: {
          id: file.versionId,
          tenantId,
          bidDocumentId: document.id,
          versionNumber,
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
      await db.bidDocument.update({
        where: { id: document.id },
        data: { revisionCode: file.revisionCode },
      });
      return created;
    });
  }
  documents(bidId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.bidDocument.findMany({
        where: { bidId, tenantId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: documentSummarySelect,
      }),
    );
  }
  documentVersions(bidId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.bidDocument.findFirst({
        where: { id: documentId, bidId, tenantId },
        select: { id: true },
      });
      if (!document) return null;
      return db.bidDocumentVersion.findMany({
        where: { tenantId, bidDocumentId: document.id },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        select: versionSelect,
      });
    });
  }

  rename(input: {
    id: string;
    name: string;
    normalizedName: string;
    projectCode: string;
  }): Promise<BidRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const current = await db.bid.findFirst({
          where: { id: input.id, tenantId },
          select: { id: true, projectCode: true },
        });
        if (!current) return null;
        await db.businessNameClaim.update({
          where: { bidId_tenantId: { bidId: input.id, tenantId } },
          data: { normalizedName: input.normalizedName, updatedAt: new Date() },
        });
        await db.bid.update({
          where: { id: input.id },
          data: {
            name: input.name,
            projectCode: input.projectCode,
            updatedAt: new Date(),
          },
        });
        const documents = await db.bidDocument.findMany({
          where: { bidId: input.id, tenantId },
          select: { id: true, generatedFileName: true },
        });
        await Promise.all(
          documents.map((document) =>
            db.bidDocument.update({
              where: { id: document.id },
              data: {
                generatedFileName: document.generatedFileName.replace(
                  ` ${current.projectCode}-`,
                  ` ${input.projectCode}-`,
                ),
                updatedAt: new Date(),
              },
            }),
          ),
        );
        return db.bid.findFirst({
          where: { id: input.id, tenantId },
          select: bidSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  reclassifyDocument(input: {
    bidId: string;
    documentId: string;
    documentCodeId: string;
    actorId: string;
  }): Promise<{
    biddingNumber: string;
    projectCode: string;
    shipmentNumber: string;
    cargoCodeSnapshot: string;
    vesselCodeSnapshot: string;
    originalFileName: string;
    storageKey: string;
    revisionCode: string;
    documentCode: string;
    previousDocumentCodeId: string;
    previousDocumentCode: string;
    previousGeneratedFileName: string;
  } | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.bidDocument.findFirst({
        where: { id: input.documentId, bidId: input.bidId, tenantId },
        select: {
          documentCodeId: true,
          documentCodeSnapshot: true,
          generatedFileName: true,
          originalFileName: true,
          storageKey: true,
          revisionCode: true,
          bid: {
            select: {
              biddingNumber: true,
              projectCode: true,
              shipmentNumber: true,
              cargoCodeSnapshot: true,
              vesselCodeSnapshot: true,
            },
          },
        },
      });
      if (!document) return null;
      const target = await db.documentCodeOption.findFirst({
        where: {
          id: input.documentCodeId,
          tenantId,
          isActive: true,
          documentGroup: {
            in: [DocumentGroupCode.GENERAL, DocumentGroupCode.MARKETING],
          },
        },
        select: { code: true },
      });
      if (!target) throw new Error('BID_REFERENCE_DOCUMENT_CODE');
      return {
        biddingNumber: document.bid.biddingNumber,
        projectCode: document.bid.projectCode,
        shipmentNumber: document.bid.shipmentNumber,
        cargoCodeSnapshot: document.bid.cargoCodeSnapshot,
        vesselCodeSnapshot: document.bid.vesselCodeSnapshot,
        originalFileName: document.originalFileName,
        storageKey: document.storageKey,
        revisionCode: document.revisionCode,
        documentCode: target.code,
        previousDocumentCodeId: document.documentCodeId,
        previousDocumentCode: document.documentCodeSnapshot,
        previousGeneratedFileName: document.generatedFileName,
      };
    });
  }

  applyReclassification(input: {
    bidId: string;
    documentId: string;
    documentCodeId: string;
    documentCode: string;
    generatedFileName: string;
    actorId: string;
    previousDocumentCodeId: string;
    previousDocumentCode: string;
    previousGeneratedFileName: string;
  }): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.bidDocument.update({
        where: { id: input.documentId },
        data: {
          documentCodeId: input.documentCodeId,
          documentCodeSnapshot: input.documentCode,
          generatedFileName: input.generatedFileName,
          updatedAt: new Date(),
        },
      });
      await db.bidDocumentClassificationEvent.create({
        data: {
          id: randomUUID(),
          tenantId,
          bidDocumentId: input.documentId,
          fromDocumentCodeId: input.previousDocumentCodeId,
          toDocumentCodeId: input.documentCodeId,
          fromDocumentCodeSnapshot: input.previousDocumentCode,
          toDocumentCodeSnapshot: input.documentCode,
          fromGeneratedFileName: input.previousGeneratedFileName,
          toGeneratedFileName: input.generatedFileName,
          changedByActorId: input.actorId,
        },
      });
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
    if (!client) throw new Error('BID_REFERENCE_CLIENT');
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
      throw new Error('BID_REFERENCE_OPTION');
    const documentCodes = await db.documentCodeOption.findMany({
      where: {
        tenantId,
        isActive: true,
        documentGroup: {
          in: [DocumentGroupCode.GENERAL, DocumentGroupCode.MARKETING],
        },
        id: { in: input.documentCodeIds },
      },
      select: { id: true, code: true, name: true },
    });
    if (documentCodes.length !== new Set(input.documentCodeIds).size)
      throw new Error('BID_REFERENCE_DOCUMENT_CODE');
    const cargo = byType.get(OptionTypeCode.CARGO_CODE);
    const vessel = byType.get(OptionTypeCode.VESSEL_CODE);
    if (!cargo?.code || !vessel?.code) throw new Error('BID_REFERENCE_OPTION');
    return {
      clientId: client.id,
      polName: byType.get(OptionTypeCode.POL)!.name,
      podName: byType.get(OptionTypeCode.POD)!.name,
      cargoCode: cargo.code,
      vesselCode: vessel.code,
      documentCodes: new Map(
        documentCodes.map((item) => [
          item.id,
          { code: item.code, name: item.name },
        ]),
      ),
    };
  }
}

const documentSummarySelect = {
  id: true,
  bidId: true,
  documentCodeId: true,
  documentCodeSnapshot: true,
  documentNameSnapshot: true,
  originalFileName: true,
  description: true,
  shipmentNumber: true,
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
} satisfies Prisma.BidDocumentSelect;
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
} satisfies Prisma.BidDocumentVersionSelect;
