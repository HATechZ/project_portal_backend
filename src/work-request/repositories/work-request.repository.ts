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
            select: { id: true, code: true },
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
            state: parent.statusEvents[0]?.toStatus.code ?? '',
          },
          bidNaming: {
            biddingNumber: parent.biddingNumber,
            projectCode: parent.projectCode,
            cargoCode: parent.cargoCodeSnapshot,
            vesselCode: parent.vesselCodeSnapshot,
            shipmentNumber: parent.shipmentNumber,
          },
          codes: new Map(rows.map((row) => [row.id, row.code])),
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
          state: parent.statusEvents[0]?.toStatus.code ?? '',
        },
        bidNaming: null,
        codes: new Map(rows.map((row) => [row.id, row.code])),
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
            ...file,
            tenantId,
            workRequestId: input.id,
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
}
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
    documentCodeId: string;
    documentCodeSnapshot: string;
    originalFileName: string;
    generatedFileName: string | null;
    storageKey: string;
    mimeType: string;
    fileSizeBytes: bigint;
  }[];
};
type WorkRequestUpdateInput = {
  title?: string;
  priority?: WorkRequestV1PriorityCode;
  notes?: string;
};
