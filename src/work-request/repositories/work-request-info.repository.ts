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
            select: workRequestInfoTargetSelect(tenantId),
          })
        : null;
      const parent = request.bid ?? request.directProject;
      return { request, target, parent };
    });
  }

  create(input: {
    workRequestId: string;
    requestedByActorId: string;
    targetActorId: string;
    message: string;
    stateAtRequest: WorkRequestV1StateCode;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1InfoRequest.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          requestedByActorId: input.requestedByActorId,
          targetActorId: input.targetActorId,
          message: input.message,
          stateAtRequest: input.stateAtRequest,
        },
        select: workRequestInfoHistorySelect,
      }),
    );
  }

  async respond(
    workRequestId: string,
    infoRequestId: string,
    actorId: string,
    message: string,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
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
          },
          select: {
            id: true,
            respondedByActorId: true,
            message: true,
            respondedAt: true,
          },
        }),
      };
    });
  }

  history(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1InfoRequest.findMany({
        where: { tenantId, workRequestId },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
        select: workRequestInfoHistorySelect,
      }),
    );
  }
}
