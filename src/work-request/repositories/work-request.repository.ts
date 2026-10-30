import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DocumentGroupCode,
  Prisma,
  WorkRequestRouteStepKind,
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
    originatingDivisionId: string,
  ) {
    const tenantId = RequestContext.requireTenantId();
    if ((bidId ? 1 : 0) + (projectId ? 1 : 0) !== 1)
      throw new Error('WR_PARENT_XOR');
    return this.transaction(async (db) => {
      const configuredGroups = codeIds.length
        ? await db.divisionDocumentGroup.findMany({
            where: { tenantId, divisionId: originatingDivisionId },
            select: { documentGroup: true },
          })
        : [];
      const allowedGroups = [
        DocumentGroupCode.GENERAL,
        ...configuredGroups.map((row) => row.documentGroup),
      ];
      const rows = codeIds.length
        ? await db.documentCodeOption.findMany({
            where: {
              id: { in: codeIds },
              tenantId,
              isActive: true,
              documentGroup: { in: allowedGroups },
            },
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
  findCreateReplay(idempotencyKey: string, actorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const event = await db.workRequestV1Event.findFirst({
        where: {
          tenantId,
          action: 'WORK_REQUEST_CREATED',
          idempotencyKey,
          performedByActorId: actorId,
        },
        select: { workRequestId: true },
      });
      return event
        ? db.workRequestV1.findFirst({
            where: { id: event.workRequestId, tenantId },
            select: workRequestSelect,
          })
        : null;
    });
  }
  create(input: WorkRequestCreateInput) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      let bidBusinessCycleId: string | null = null;
      if (input.bidId) {
        const bid = await db.bid.findFirst({
          where: { id: input.bidId, tenantId },
          select: {
            statusEvents: {
              take: 1,
              orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
              select: { toStatus: { select: { code: true } } },
            },
            businessCycles: {
              where: { closedAt: null },
              take: 1,
              orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
              select: { id: true },
            },
          },
        });
        if (bid?.statusEvents[0]?.toStatus.code !== 'BIDDING')
          throw new Error('WR_PARENT_INACTIVE');
        bidBusinessCycleId = bid.businessCycles[0]?.id ?? null;
        if (!bidBusinessCycleId) throw new Error('WR_BID_CYCLE');
      }
      await db.workRequestV1.create({
        data: {
          id: input.id,
          tenantId,
          bidId: input.bidId,
          directProjectId: input.projectId,
          bidBusinessCycleId,
          title: input.title,
          priority: input.priority,
          notes: input.notes,
          createdByActorId: input.actorId,
        },
      });
      await db.workRequestV1Event.create({
        data: {
          id: input.creationEventId,
          tenantId,
          workRequestId: input.id,
          action: 'WORK_REQUEST_CREATED',
          resultingState: WorkRequestV1StateCode.CREATED,
          performedByActorId: input.actorId,
          correlationId: input.idempotencyKey,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (input.originatingDivisionId && input.intermediateDivisionIds) {
        const lead = await db.divisionLead.findFirst({
          where: {
            tenantId,
            divisionId: input.originatingDivisionId,
            ...(input.responsibleOriginatingDivisionLeadId
              ? { id: input.responsibleOriginatingDivisionLeadId }
              : { memberId: input.actorMemberId! }),
            revokedAt: null,
            member: {
              is: {
                isActive: true,
              },
            },
          },
          select: { id: true },
        });
        if (!lead) throw new Error('WR_ROUTE_ORIGIN_LEAD');
        const divisionIds = [
          ...new Set([
            input.originatingDivisionId,
            ...input.intermediateDivisionIds,
          ]),
        ];
        const divisions = await db.division.findMany({
          where: { tenantId, id: { in: divisionIds }, isActive: true },
          select: { id: true },
        });
        if (divisions.length !== divisionIds.length)
          throw new Error('WR_ROUTE_DIVISION');
        const cutovers = await db.$queryRaw<Array<{ cutoverAt: Date }>>(
          Prisma.sql`SELECT cutover_at AS "cutoverAt" FROM work_request_route_cutovers WHERE id = 1`,
        );
        if (!cutovers[0]) throw new Error('WR_ROUTE_CUTOVER');
        const routeId = randomUUID(),
          versionId = randomUUID();
        const steps = [
          {
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.ORIGIN_START,
            divisionId: input.originatingDivisionId,
          },
          ...input.intermediateDivisionIds.map((divisionId) => ({
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.INTERMEDIATE,
            divisionId,
          })),
          {
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.ORIGIN_FINAL_REVIEW,
            divisionId: input.originatingDivisionId,
          },
          {
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.CLIENT,
            divisionId: null,
          },
        ];
        await db.workRequestRoute.create({
          data: {
            id: routeId,
            tenantId,
            workRequestId: input.id,
            bidId: input.bidId,
            directProjectId: input.projectId,
            bidBusinessCycleId,
            originatingDivisionId: input.originatingDivisionId,
            responsibleOriginatingDivisionLeadId: lead.id,
            cutoverAt: cutovers[0].cutoverAt,
          },
        });
        await db.workRequestRouteVersion.create({
          data: {
            id: versionId,
            tenantId,
            routeId,
            versionNumber: 1,
            createdByActorId: input.actorId,
          },
        });
        await db.workRequestRouteStep.createMany({
          data: steps.map((step, ordinal) => ({
            ...step,
            tenantId,
            routeId,
            routeVersionId: versionId,
            ordinal: ordinal + 1,
            activatedAt: ordinal === 0 ? new Date() : null,
          })),
        });
        const originCycleId = randomUUID();
        await db.workRequestDivisionCycle.create({
          data: {
            id: originCycleId,
            tenantId,
            routeId,
            routeStepId: steps[0].id,
          },
        });
        await db.workRequestRouteProjection.create({
          data: {
            id: randomUUID(),
            tenantId,
            routeId,
            routeVersionId: versionId,
            routeStepId: steps[0].id,
            divisionCycleId: originCycleId,
          },
        });
        await db.workRequestRouteEvent.create({
          data: {
            id: randomUUID(),
            tenantId,
            routeId,
            routeStepId: steps[0].id,
            action: 'ROUTE_CREATED',
            performedByActorId: input.actorId,
          },
        });
        await db.workRequestRouteEvent.create({
          data: {
            id: randomUUID(),
            tenantId,
            routeId,
            routeStepId: steps[0].id,
            divisionCycleId: originCycleId,
            action: 'DIVISION_CYCLE_ACTIVATED',
            performedByActorId: input.actorId,
          },
        });
      }
      if (input.files.length)
        await db.workRequestV1Document.createMany({
          data: input.files.map((file) => ({
            id: file.id,
            documentCodeId: file.documentCodeId,
            documentCodeSnapshot: file.documentCodeSnapshot,
            documentNameSnapshot: file.documentNameSnapshot,
            originalFileName: file.originalFileName,
            description: file.description,
            shipmentNumber: file.shipmentNumber,
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
            revisionCode: input.revisionCode,
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
  routeProjection(
    workRequestId: string,
    memberId: string | null,
    isAdmin = false,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route = await db.workRequestRoute.findFirst({
        where: {
          tenantId,
          workRequestId,
          ...(isAdmin
            ? {}
            : {
                responsibleOriginatingLead: {
                  is: { memberId: memberId!, revokedAt: null },
                },
              }),
        },
        include: {
          projection: true,
          steps: {
            orderBy: { ordinal: 'asc' },
            include: { division: { select: { id: true, name: true } } },
          },
        },
      });
      return route;
    });
  }
  forwardRoute(
    workRequestId: string,
    stepId: string,
    actorId: string,
    memberId: string | null,
    isAdmin = false,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const route = await db.workRequestRoute.findFirst({
          where: { tenantId, workRequestId },
          include: { projection: true },
        });
        if (
          !route?.projection?.routeStepId ||
          route.projection.routeStepId !== stepId
        )
          throw new Error('WR_ROUTE_POSITION');
        const current = await db.workRequestRouteStep.findFirst({
          where: { tenantId, id: stepId, routeId: route.id },
        });
        if (!current || current.completedAt)
          throw new Error('WR_ROUTE_POSITION');
        if (current.divisionId && !isAdmin) {
          const lead = await db.divisionLead.findFirst({
            where: {
              tenantId,
              divisionId: current.divisionId,
              memberId: memberId!,
              revokedAt: null,
            },
            select: { id: true },
          });
          if (!lead) throw new Error('WR_ROUTE_DIVISION_LEAD');
          const cycle = await db.workRequestDivisionCycle.findFirst({
            where: { tenantId, routeId: route.id, routeStepId: current.id },
          });
          if (!cycle?.completedAt)
            throw new Error('WR_DIVISION_CYCLE_INCOMPLETE');
        }
        const next = await db.workRequestRouteStep.findFirst({
          where: {
            tenantId,
            routeId: route.id,
            routeVersionId:
              route.projection.routeVersionId ?? current.routeVersionId,
            ordinal: current.ordinal + 1,
          },
        });
        if (!next) throw new Error('WR_ROUTE_COMPLETE');
        // The Client tail is entered only by Phase 7's C1 gateway.  A normal
        // forward here would create a Client-visible position without its
        // immutable exact-version package.
        if (next.kind === WorkRequestRouteStepKind.CLIENT)
          throw new Error('WR_ROUTE_CLIENT_GATEWAY');
        const now = new Date();
        await db.workRequestRouteStep.update({
          where: { id: current.id },
          data: { completedAt: now },
        });
        await db.workRequestRouteStep.update({
          where: { id: next.id },
          data: { activatedAt: now },
        });
        const nextCycleId = next.divisionId ? randomUUID() : null;
        if (nextCycleId)
          await db.workRequestDivisionCycle.create({
            data: {
              id: nextCycleId,
              tenantId,
              routeId: route.id,
              routeStepId: next.id,
              activatedAt: now,
            },
          });
        await db.workRequestRouteProjection.update({
          where: { routeId_tenantId: { routeId: route.id, tenantId } },
          data: {
            routeStepId: next.id,
            divisionCycleId: nextCycleId,
            teamStepId: null,
            memberStepId: null,
            updatedAt: now,
          },
        });
        await db.workRequestRouteEvent.create({
          data: {
            id: randomUUID(),
            tenantId,
            routeId: route.id,
            routeStepId: next.id,
            action: 'ROUTE_FORWARDED',
            performedByActorId: actorId,
          },
        });
        if (nextCycleId)
          await db.workRequestRouteEvent.create({
            data: {
              id: randomUUID(),
              tenantId,
              routeId: route.id,
              routeStepId: next.id,
              divisionCycleId: nextCycleId,
              action: 'DIVISION_CYCLE_ACTIVATED',
              performedByActorId: actorId,
            },
          });
        return this.routeProjection(workRequestId, memberId, isAdmin);
      },
      { isolationLevel: 'Serializable' },
    );
  }
  amendRoute(
    workRequestId: string,
    input: { baseRouteVersionId: string; intermediateDivisionIds: string[] },
    actorId: string,
    memberId: string | null,
    isAdmin = false,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const route = await db.workRequestRoute.findFirst({
          where: {
            tenantId,
            workRequestId,
            ...(isAdmin
              ? {}
              : {
                  responsibleOriginatingLead: {
                    is: { memberId: memberId!, revokedAt: null },
                  },
                }),
          },
          include: {
            projection: true,
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        });
        if (
          !route?.projection ||
          route.projection.routeVersionId !== input.baseRouteVersionId ||
          !route.projection.routeStepId
        )
          throw new Error('WR_ROUTE_STALE');
        const active = await db.workRequestRouteStep.findFirst({
          where: {
            tenantId,
            id: route.projection.routeStepId,
            routeId: route.id,
          },
        });
        if (!active) throw new Error('WR_ROUTE_POSITION');
        const ids = [...new Set(input.intermediateDivisionIds)];
        const divisions = ids.length
          ? await db.division.findMany({
              where: { tenantId, id: { in: ids }, isActive: true },
              select: { id: true },
            })
          : [];
        if (divisions.length !== ids.length)
          throw new Error('WR_ROUTE_DIVISION');
        const versionId = randomUUID();
        await db.workRequestRouteVersion.create({
          data: {
            id: versionId,
            tenantId,
            routeId: route.id,
            versionNumber: (route.versions[0]?.versionNumber ?? 0) + 1,
            predecessorVersionId: input.baseRouteVersionId,
            createdByActorId: actorId,
          },
        });
        const steps = [
          ...input.intermediateDivisionIds.map((divisionId) => ({
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.INTERMEDIATE,
            divisionId,
          })),
          {
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.ORIGIN_FINAL_REVIEW,
            divisionId: route.originatingDivisionId,
          },
          {
            id: randomUUID(),
            kind: WorkRequestRouteStepKind.CLIENT,
            divisionId: null,
          },
        ];
        await db.workRequestRouteStep.createMany({
          data: steps.map((step, index) => ({
            ...step,
            tenantId,
            routeId: route.id,
            routeVersionId: versionId,
            ordinal: active.ordinal + index + 1,
          })),
        });
        await db.workRequestRouteProjection.update({
          where: { routeId_tenantId: { routeId: route.id, tenantId } },
          data: { routeVersionId: versionId },
        });
        await db.workRequestRouteEvent.create({
          data: {
            id: randomUUID(),
            tenantId,
            routeId: route.id,
            routeStepId: active.id,
            action: 'ROUTE_AMENDED',
            performedByActorId: actorId,
          },
        });
        return this.routeProjection(workRequestId, memberId);
      },
      { isolationLevel: 'Serializable' },
    );
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
          route: {
            select: {
              originatingDivisionId: true,
              projection: {
                select: { routeStep: { select: { divisionId: true } } },
              },
            },
          },
          assignments: {
            where: {
              level: 'DIVISION',
              unassignedAt: null,
              replacedAt: null,
            },
            select: { divisionId: true },
          },
        },
      });
      if (!request) return null;
      const divisionId = this.currentDocumentDivisionId(request);
      if (!divisionId) throw new Error('WR_DOCUMENT_CONTEXT');
      const configuredGroups = await db.divisionDocumentGroup.findMany({
        where: { tenantId, divisionId },
        select: { documentGroup: true },
      });
      const allowedGroups = [
        DocumentGroupCode.GENERAL,
        ...configuredGroups.map((row) => row.documentGroup),
      ];
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
        where: {
          id: { in: documentCodeIds },
          tenantId,
          isActive: true,
          documentGroup: { in: allowedGroups },
        },
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
  async availableDocumentCodes(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          id: true,
          bid: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          directProject: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          route: {
            select: {
              originatingDivisionId: true,
              projection: {
                select: { routeStep: { select: { divisionId: true } } },
              },
            },
          },
          assignments: {
            where: { level: 'DIVISION', unassignedAt: null, replacedAt: null },
            select: { divisionId: true },
          },
        },
      });
      if (!request) return null;
      const divisionId = this.currentDocumentDivisionId(request);
      if (!divisionId) throw new Error('WR_DOCUMENT_CONTEXT');
      const groups = await db.divisionDocumentGroup.findMany({
        where: { tenantId, divisionId },
        select: { documentGroup: true },
      });
      const parent = request.bid ?? request.directProject;
      if (!parent) throw new Error('WR_PARENT');
      return {
        parent: {
          clientId: parent.clientId,
          companyId: parent.client.companyId,
        },
        divisionId,
        codes: await db.documentCodeOption.findMany({
          where: {
            tenantId,
            isActive: true,
            documentGroup: {
              in: [
                DocumentGroupCode.GENERAL,
                ...groups.map((group) => group.documentGroup),
              ],
            },
          },
          select: { id: true, code: true, name: true, documentGroup: true },
          orderBy: [
            { documentGroup: 'asc' },
            { sortOrder: 'asc' },
            { code: 'asc' },
          ],
        }),
      };
    });
  }

  private currentDocumentDivisionId(request: {
    route: {
      originatingDivisionId: string;
      projection: { routeStep: { divisionId: string | null } | null } | null;
    } | null;
    assignments: { divisionId: string | null }[];
  }): string | null {
    const routeDivisionId = request.route?.projection?.routeStep?.divisionId;
    // A route request must have an active Division-bearing route step. Falling
    // back to origin would select stale codes during client/revision branches.
    if (request.route) return routeDivisionId ?? null;
    const divisionIds = new Set(
      request.assignments.flatMap((assignment) =>
        assignment.divisionId ? [assignment.divisionId] : [],
      ),
    );
    return divisionIds.size === 1 ? [...divisionIds][0] : null;
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
            description: file.description,
            shipmentNumber: file.shipmentNumber,
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
      const created = await db.workRequestV1DocumentVersion.create({
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
      await db.workRequestV1Document.update({
        where: { id: document.id },
        data: { revisionCode: file.revisionCode },
      });
      return created;
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
  actorMemberId: string | null;
  responsibleOriginatingDivisionLeadId?: string;
  creationEventId: string;
  idempotencyKey: string;
  revisionCode: string;
  originatingDivisionId: string;
  intermediateDivisionIds: string[];
  files: {
    id: string;
    versionId: string;
    documentCodeId: string;
    documentCodeSnapshot: string;
    documentNameSnapshot: string;
    originalFileName: string;
    description: string | null;
    shipmentNumber: string | null;
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
