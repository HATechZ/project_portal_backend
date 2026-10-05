import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WorkRequestV1PriorityCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { workRequestSelect } from './work-request.records';
import type { NewDocumentDraft } from '../../common/documents/document-upload.pipeline';
import type { NewDocumentVersionDraft } from '../../common/documents/document-upload.pipeline';

@Injectable()
export class WorkRequestRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  async prepareCreate(
    bidId: string | undefined,
    projectId: string | undefined,
    codeIds: string[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    if ((bidId ? 1 : 0) + (projectId ? 1 : 0) !== 1)
      throw new Error('WR_PARENT_XOR');
    return this.transaction(async (db) => {
      const rows = codeIds.length
        ? await db.documentCodeOption.findMany({
            where: { id: { in: codeIds }, tenantId, isActive: true },
            select: { id: true, code: true, name: true },
          })
        : [];
      if (rows.length !== new Set(codeIds).size)
        throw new Error('WR_DOCUMENT_CODE');
      if (bidId) {
        const parent = await db.bid.findFirst({
          where: { id: bidId, tenantId },
          select: bidParentSelect,
        });
        if (!parent) throw new Error('WR_PARENT');
        return {
          parent: {
            clientId: parent.clientId,
            companyId: parent.client.companyId,
            divisionId: null,
            teamId: null,
            state: parent.statusEvents[0]?.toStatus.code ?? '',
          },
          bidNaming: {
            biddingNumber: parent.biddingNumber,
            projectCode: parent.projectCode,
            cargoCode: parent.cargoCodeSnapshot,
            vesselCode: parent.vesselCodeSnapshot,
            shipmentNumber: parent.shipmentNumber,
          },
          projectNaming: null,
          codes: new Map(
            rows.map((row) => [row.id, { code: row.code, name: row.name }]),
          ),
        };
      }
      const parent = await db.directProject.findFirst({
        where: { id: projectId!, tenantId },
        select: projectParentSelect,
      });
      if (!parent) throw new Error('WR_PARENT');
      return {
        parent: {
          clientId: parent.clientId,
          companyId: parent.client.companyId,
          divisionId: null,
          teamId: null,
          state: parent.statusEvents[0]?.toStatus.code ?? '',
        },
        bidNaming: null,
        projectNaming: {
          projectCode: parent.projectCode,
          cargoCode: parent.cargoCodeSnapshot,
          vesselCode: parent.vesselCodeSnapshot,
          shipmentNumber: parent.shipmentNumber,
        },
        codes: new Map(
          rows.map((row) => [row.id, { code: row.code, name: row.name }]),
        ),
      };
    });
  }
  create(input: WorkRequestCreateInput) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.workRequestV1.create({
        data: {
          id: input.id,
          tenantId,
          bidId: input.bidId,
          directProjectId: input.projectId,
          title: input.title,
          priority: input.priority,
          notes: input.notes,
          createdByActorId: input.actorId,
        },
      });
      await db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.id,
          action: 'WORK_REQUEST_CREATED',
          resultingState: WorkRequestV1StateCode.CREATED,
          performedByActorId: input.actorId,
        },
      });
      if (input.files.length)
        await db.workRequestV1Document.createMany({
          data: input.files.map((file) => ({
            id: file.id,
            documentCodeId: file.documentCodeId,
            documentCodeSnapshot: file.documentCodeSnapshot,
            documentNameSnapshot: file.documentNameSnapshot,
            originalFileName: file.originalFileName,
            generatedFileName: file.generatedFileName,
            storageKey: file.storageKey,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            tenantId,
            workRequestId: input.id,
            uploadedByActorId: input.actorId,
          })),
        });
      if (input.files.length)
        await db.workRequestV1DocumentVersion.createMany({
          data: input.files.map((file) => ({
            id: file.versionId,
            tenantId,
            workRequestV1DocumentId: file.id,
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
      return db.workRequestV1.findFirstOrThrow({
        where: { id: input.id, tenantId },
        select: workRequestSelect,
      });
    });
  }
  async update(id: string, input: WorkRequestUpdateInput) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const current = await db.workRequestV1.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!current) return null;
      await db.workRequestV1.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      });
      return db.workRequestV1.findFirst({
        where: { id, tenantId },
        select: workRequestSelect,
      });
    });
  }
  async prepareStandaloneDocuments(
    workRequestId: string,
    documentCodeIds: string[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          id: true,
          bid: {
            select: {
              id: true,
              clientId: true,
              client: { select: { companyId: true } },
              biddingNumber: true,
              projectCode: true,
              cargoCodeSnapshot: true,
              vesselCodeSnapshot: true,
              shipmentNumber: true,
            },
          },
          directProject: {
            select: {
              id: true,
              clientId: true,
              client: { select: { companyId: true } },
              projectCode: true,
              cargoCodeSnapshot: true,
              vesselCodeSnapshot: true,
              shipmentNumber: true,
            },
          },
        },
      });
      if (!request) return null;
      const parent = request.bid ?? request.directProject;
      if (
        !parent ||
        !parent.projectCode ||
        !parent.cargoCodeSnapshot ||
        !parent.vesselCodeSnapshot ||
        !parent.shipmentNumber
      )
        throw new Error('WR_NAMING_CONTEXT');
      const codes = await db.documentCodeOption.findMany({
        where: { id: { in: documentCodeIds }, tenantId, isActive: true },
        select: { id: true, code: true, name: true },
      });
      if (codes.length !== new Set(documentCodeIds).size)
        throw new Error('WR_DOCUMENT_CODE');
      return {
        request,
        parent: {
          clientId: parent.clientId,
          companyId: parent.client.companyId,
        },
        naming: request.bid
          ? {
              kind: 'BID' as const,
              biddingNumber: request.bid.biddingNumber,
              projectCode: request.bid.projectCode,
              cargoCode: request.bid.cargoCodeSnapshot,
              vesselCode: request.bid.vesselCodeSnapshot,
              shipmentNumber: request.bid.shipmentNumber,
            }
          : {
              kind: 'PROJECT' as const,
              projectCode: request.directProject!.projectCode!,
              cargoCode: request.directProject!.cargoCodeSnapshot!,
              vesselCode: request.directProject!.vesselCodeSnapshot!,
              shipmentNumber: request.directProject!.shipmentNumber!,
            },
        codes: new Map(
          codes.map((code) => [code.id, { code: code.code, name: code.name }]),
        ),
      };
    });
  }
  createStandaloneDocuments(
    workRequestId: string,
    actorId: string,
    files: NewDocumentDraft[],
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: { id: true },
      });
      if (!request) return null;
      for (const file of files)
        await db.workRequestV1Document.create({
          data: {
            id: file.documentId,
            tenantId,
            workRequestId,
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
      return db.workRequestV1Document.findMany({
        where: { tenantId, id: { in: files.map((file) => file.documentId) } },
        select: documentSummarySelect,
      });
    });
  }
  prepareDocumentVersion(workRequestId: string, documentId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Document.findFirst({
        where: { id: documentId, workRequestId, tenantId },
        select: {
          id: true,
          workRequestId: true,
          documentCodeSnapshot: true,
          documentNameSnapshot: true,
          originalFileName: true,
          revisionCode: true,
          workRequest: {
            select: {
              events: {
                take: 1,
                orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
                select: { resultingState: true },
              },
              assignments: {
                where: {
                  unassignedAt: null,
                  replacedAt: null,
                  level: 'MEMBER',
                },
                select: { memberId: true },
              },
              bid: {
                select: {
                  clientId: true,
                  client: { select: { companyId: true } },
                  biddingNumber: true,
                  projectCode: true,
                  cargoCodeSnapshot: true,
                  vesselCodeSnapshot: true,
                  shipmentNumber: true,
                },
              },
              directProject: {
                select: {
                  clientId: true,
                  client: { select: { companyId: true } },
                  projectCode: true,
                  cargoCodeSnapshot: true,
                  vesselCodeSnapshot: true,
                  shipmentNumber: true,
                },
              },
            },
          },
        },
      }),
    );
  }
  appendDocumentVersion(
    workRequestId: string,
    documentId: string,
    actorId: string,
    file: NewDocumentVersionDraft,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const document = await db.workRequestV1Document.findFirst({
        where: { id: documentId, workRequestId, tenantId },
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
      return db.workRequestV1DocumentVersion.create({
        data: {
          id: file.versionId,
          tenantId,
          workRequestV1DocumentId: document.id,
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
}
const documentSummarySelect = {
  id: true,
  workRequestId: true,
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
} satisfies Prisma.WorkRequestV1DocumentSelect;
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
} satisfies Prisma.WorkRequestV1DocumentVersionSelect;
const bidParentSelect = {
  clientId: true,
  client: { select: { companyId: true } },
  statusEvents: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { toStatus: { select: { code: true } } },
  },
  biddingNumber: true,
  projectCode: true,
  cargoCodeSnapshot: true,
  vesselCodeSnapshot: true,
  shipmentNumber: true,
} satisfies Prisma.BidSelect;
const projectParentSelect = {
  clientId: true,
  client: { select: { companyId: true } },
  statusEvents: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { toStatus: { select: { code: true } } },
  },
  projectCode: true,
  cargoCodeSnapshot: true,
  vesselCodeSnapshot: true,
  shipmentNumber: true,
} satisfies Prisma.DirectProjectSelect;
type WorkRequestCreateInput = {
  id: string;
  bidId?: string;
  projectId?: string;
  title: string;
  priority: WorkRequestV1PriorityCode;
  notes?: string;
  actorId: string;
  files: {
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
  }[];
};
type WorkRequestUpdateInput = {
  title?: string;
  notes?: string;
};
