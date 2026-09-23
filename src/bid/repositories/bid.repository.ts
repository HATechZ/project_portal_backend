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
      documentCodeId: true,
      originalFileName: true,
      generatedFileName: true,
      storageKey: true,
      mimeType: true,
      fileSizeBytes: true,
    },
  },
  _count: { select: { documents: true } },
} satisfies Prisma.BidSelect;

export type BidRecord = Prisma.BidGetPayload<{ select: typeof bidSelect }>;

export interface BidFileInput {
  id: string;
  documentCodeId: string;
  documentCodeSnapshot: string;
  originalFileName: string;
  generatedFileName: string;
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
  documentCodes: Map<string, string>;
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
        if (input.files.length) {
          await db.bidDocument.createMany({
            data: input.files.map((file) => ({
              ...file,
              tenantId,
              bidId: input.id,
              uploadedByActorId: input.actorId,
              revisionCode: 'A',
            })),
          });
          await db.bidDocumentVersion.createMany({
            data: input.files.map((file) => ({
              id: randomUUID(),
              tenantId,
              bidDocumentId: file.id,
              versionNumber: 1,
              originalFileName: file.originalFileName,
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

  list(args: { skip: number; take: number }): Promise<BidRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.bid.findMany({
        where: { tenantId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        select: bidSelect,
      }),
    );
  }

  count(): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.bid.count({ where: { tenantId } }));
  }

  find(id: string): Promise<BidRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.bid.findFirst({ where: { id, tenantId }, select: bidSelect }),
    );
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
          documentGroup: DocumentGroupCode.MARKETING,
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
        documentGroup: DocumentGroupCode.MARKETING,
        id: { in: input.documentCodeIds },
      },
      select: { id: true, code: true },
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
      documentCodes: new Map(documentCodes.map((item) => [item.id, item.code])),
    };
  }
}
