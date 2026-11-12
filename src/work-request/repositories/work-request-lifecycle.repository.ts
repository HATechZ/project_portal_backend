import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

type LifecycleWrite =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | {
      kind: 'ok';
      id: string;
      archivedAt: Date | null;
      archivedByActorId: string | null;
      archiveReason: string | null;
      event: { id: string; action: string; occurredAt: Date };
    };

@Injectable()
export class WorkRequestLifecycleRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  async isArchived(workRequestId: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    const record = await this.transaction((db) =>
      db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: { archivedAt: true },
      }),
    );
    return record?.archivedAt !== null && record?.archivedAt !== undefined;
  }

  archive(
    workRequestId: string,
    actorId: string,
    reason: string | undefined,
    idempotencyKey: string | undefined,
  ): Promise<LifecycleWrite> {
    return this.write(workRequestId, actorId, reason, idempotencyKey, true);
  }

  restore(
    workRequestId: string,
    actorId: string,
    idempotencyKey: string | undefined,
  ): Promise<LifecycleWrite> {
    return this.write(workRequestId, actorId, undefined, idempotencyKey, false);
  }

  private async write(
    workRequestId: string,
    actorId: string,
    reason: string | undefined,
    idempotencyKey: string | undefined,
    archive: boolean,
  ): Promise<LifecycleWrite> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const current = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          id: true,
          archivedAt: true,
          archivedByActorId: true,
          archiveReason: true,
          events: {
            take: 1,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: { resultingState: true },
          },
        },
      });
      if (!current) return { kind: 'missing' };
      if ((current.archivedAt !== null) === archive)
        return { kind: 'conflict' };

      const at = new Date();
      const updated = await db.workRequestV1.updateMany({
        where: {
          id: workRequestId,
          tenantId,
          archivedAt: archive ? null : { not: null },
        },
        data: archive
          ? {
              archivedAt: at,
              archivedByActorId: actorId,
              archiveReason: reason ?? null,
            }
          : { archivedAt: null, archivedByActorId: null, archiveReason: null },
      });
      if (updated.count !== 1) return { kind: 'conflict' };

      const event = await db.workRequestV1Event.create({
        data: {
          tenantId,
          id: randomUUID(),
          workRequestId,
          action: archive ? 'WORK_REQUEST_ARCHIVED' : 'WORK_REQUEST_RESTORED',
          priorState: current.events[0]?.resultingState ?? null,
          resultingState: current.events[0]?.resultingState ?? null,
          performedByActorId: actorId,
          occurredAt: at,
          note: archive ? (reason ?? null) : null,
          correlationId: RequestContext.requestId(),
          idempotencyKey,
        },
        select: { id: true, action: true, occurredAt: true },
      });
      return {
        kind: 'ok',
        id: current.id,
        archivedAt: archive ? at : null,
        archivedByActorId: archive ? actorId : null,
        archiveReason: archive ? (reason ?? null) : null,
        event,
      };
    });
  }
}
