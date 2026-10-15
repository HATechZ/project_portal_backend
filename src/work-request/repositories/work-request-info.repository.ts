import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  InfoRequestStatusCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  type WorkRequestInfoSnapshot,
  workRequestInfoHistorySelect,
  workRequestInfoSelect,
  workRequestInfoTargetSelect,
} from './work-request-info.records';

@Injectable()
export class WorkRequestInfoRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  async prepare(
    workRequestId: string,
    targetActorId?: string,
    infoRequestId?: string,
  ): Promise<WorkRequestInfoSnapshot | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: workRequestInfoSelect,
      });
      if (!request) return null;
      const target = targetActorId
        ? await db.actorProfile.findFirst({
            where: { id: targetActorId, tenantId, isActive: true },
            select: workRequestInfoTargetSelect(),
          })
        : null;
      const info = infoRequestId
        ? await db.workRequestV1InfoRequest.findFirst({
            where: { id: infoRequestId, tenantId, workRequestId },
            select: { requestedByActorId: true, targetActorId: true },
          })
        : null;
      const parent = request.bid ?? request.directProject;
      return { request, target, parent, info };
    });
  }

  create(input: {
    workRequestId: string;
    requestedByActorId: string;
    targetActorId: string;
    message: string;
    stateAtRequest: WorkRequestV1StateCode;
    parentInfoRequestId?: string;
    documentVersionIds?: string[];
    idempotencyKey?: string;
    correlationId?: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      if (input.parentInfoRequestId) {
        const parent = await db.workRequestV1InfoRequest.findFirst({ where: { id: input.parentInfoRequestId, tenantId, workRequestId: input.workRequestId, status: InfoRequestStatusCode.OPEN }, select: { requestedByActorId: true, targetActorId: true } });
        if (!parent) throw new Error('INFO_PARENT');
        if (input.requestedByActorId !== parent.requestedByActorId && input.requestedByActorId !== parent.targetActorId) throw new Error('INFO_PARENT_PARTICIPANT');
      }
      const existing = input.idempotencyKey
        ? await db.workRequestV1InfoRequest.findFirst({
            where: { tenantId, idempotencyKey: input.idempotencyKey },
            select: workRequestInfoHistorySelect,
          })
        : null;
      if (existing) return { request: existing, duplicate: true };
      const request = await db.workRequestV1InfoRequest.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          requestedByActorId: input.requestedByActorId,
          targetActorId: input.targetActorId,
          message: input.message,
          stateAtRequest: input.stateAtRequest,
          parentInfoRequestId: input.parentInfoRequestId,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          attachments: {
            create: (input.documentVersionIds ?? []).map((documentVersionId) => ({
              id: randomUUID(),
              tenantId,
              documentVersionId,
            })),
          },
        },
        select: workRequestInfoHistorySelect,
      });
      return { request, duplicate: false };
    });
  }

  async respond(
    workRequestId: string,
    infoRequestId: string,
    actorId: string,
    message: string,
    documentVersionIds?: string[],
    idempotencyKey?: string,
    correlationId?: string,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const existing = idempotencyKey
        ? await db.workRequestV1InfoResponse.findFirst({
            where: { tenantId, idempotencyKey },
            select: { id: true, respondedByActorId: true, message: true, respondedAt: true, attachments: { select: { documentVersionId: true } } },
          })
        : null;
      if (existing) return { kind: 'duplicate' as const, response: existing };
      const request = await db.workRequestV1InfoRequest.findFirst({
        where: { id: infoRequestId, workRequestId, tenantId },
        select: { targetActorId: true, status: true },
      });
      if (!request) return { kind: 'missing' as const };
      if (request.targetActorId !== actorId)
        return { kind: 'forbidden' as const };
      const at = new Date();
      const closed = await db.workRequestV1InfoRequest.updateMany({
        where: {
          id: infoRequestId,
          tenantId,
          status: InfoRequestStatusCode.OPEN,
        },
        data: { status: InfoRequestStatusCode.RESPONDED, closedAt: at },
      });
      if (closed.count !== 1) return { kind: 'closed' as const };
      return {
        kind: 'ok' as const,
        response: await db.workRequestV1InfoResponse.create({
          data: {
            id: randomUUID(),
            tenantId,
            infoRequestId,
            respondedByActorId: actorId,
            message,
            respondedAt: at,
            idempotencyKey,
            correlationId,
            attachments: {
              create: (documentVersionIds ?? []).map((documentVersionId) => ({
                id: randomUUID(),
                tenantId,
                documentVersionId,
              })),
            },
          },
          select: {
            id: true,
            respondedByActorId: true,
            message: true,
            respondedAt: true,
            attachments: { select: { documentVersionId: true } },
          },
        }),
      };
    });
  }

  history(workRequestId: string, participantActorId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1InfoRequest.findMany({
        where: {
          tenantId,
          workRequestId,
          ...(participantActorId
            ? { OR: [{ requestedByActorId: participantActorId }, { targetActorId: participantActorId }] }
            : {}),
        },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
        select: workRequestInfoHistorySelect,
      }),
    );
  }

  async hasDocumentVersions(workRequestId: string, ids: string[]) {
    const tenantId = RequestContext.requireTenantId();
    const versions = await this.transaction((db) =>
      db.workRequestV1DocumentVersion.findMany({
        where: { tenantId, id: { in: ids }, document: { workRequestId } },
        select: { id: true },
      }),
    );
    return versions.length === ids.length;
  }
}
