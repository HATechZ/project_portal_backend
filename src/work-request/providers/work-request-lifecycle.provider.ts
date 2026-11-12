import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import type { SessionActor } from '../../common/security/session.types';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';
import { WorkRequestLifecycleRepository } from '../repositories/work-request-lifecycle.repository';

@Injectable()
export class WorkRequestLifecycleProvider {
  constructor(
    private readonly lifecycle: WorkRequestLifecycleRepository,
    private readonly reads: WorkRequestReadRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
  ) {}

  async assertActive(workRequestId: string): Promise<void> {
    if (await this.lifecycle.isArchived(workRequestId)) throw archived();
  }

  isArchived(workRequestId: string): Promise<boolean> {
    return this.lifecycle.isArchived(workRequestId);
  }

  archive(
    workRequestId: string,
    reason: string | undefined,
    actor: SessionActor,
  ) {
    return this.change(workRequestId, reason, actor, true);
  }

  restore(workRequestId: string, actor: SessionActor) {
    return this.change(workRequestId, undefined, actor, false);
  }

  private async change(
    workRequestId: string,
    reason: string | undefined,
    actor: SessionActor,
    archive: boolean,
  ) {
    if (!(await this.reads.find(workRequestId, actor))) throw notFound();
    const result = await this.uow.execute(
      async () => {
        const changed = await (archive
          ? this.lifecycle.archive(
              workRequestId,
              actor.id,
              reason,
              RequestContext.requestId(),
            )
          : this.lifecycle.restore(
              workRequestId,
              actor.id,
              RequestContext.requestId(),
            ));
        if (changed.kind === 'ok')
          await this.outbox.enqueue(
            new WorkRequestTransitioned(
              {
                tenantId: RequestContext.requireTenantId(),
                actorId: actor.id,
                eventId: changed.event.id,
                occurredAt: changed.event.occurredAt.toISOString(),
                correlationId: RequestContext.requestId(),
              },
              {
                workRequestId,
                action: changed.event.action,
                priorState: '',
                resultingState: '',
              },
            ),
          );
        return changed;
      },
      { isolationLevel: 'Serializable' },
    );
    if (result.kind === 'missing') throw notFound();
    if (result.kind === 'conflict')
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: archive
          ? 'Work Request is already archived.'
          : 'Work Request is already active.',
      });
    return {
      id: result.id,
      lifecycle: {
        status: result.archivedAt ? ('archived' as const) : ('active' as const),
        archivedAt: result.archivedAt,
        archivedByActorId: result.archivedByActorId,
        reason: result.archiveReason,
      },
    };
  }
}

export function archived(): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message: 'Work Request is archived and read-only.',
  });
}

function notFound(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: 'Work Request was not found.',
  });
}
