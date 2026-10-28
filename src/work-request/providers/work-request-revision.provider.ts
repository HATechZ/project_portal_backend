import { Injectable } from '@nestjs/common';
import { CustomRoleScope, WorkRequestRouteRevisionClassification as Classification } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestTransitioned } from '../../contracts/events/work-request-events';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { workRequestTransitionRequestMetadata } from './work-request-transition.definitions';
import {
  RequestWorkRequestRouteRevisionDto,
  ResubmitWorkRequestRouteRevisionDto,
} from '../dtos/work-request.dto';
import { WorkRequestRevisionRepository } from '../repositories/work-request-revision.repository';

@Injectable()
export class WorkRequestRevisionProvider {
  constructor(
    private readonly revisions: WorkRequestRevisionRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
  ) {}

  request(id: string, input: RequestWorkRequestRouteRevisionDto, actor: SessionActor) {
    return this.uow.execute(async () => {
      const admin = hasTenantWideInternalAuthority(actor);
      if (!admin && !scopeAllows(actor.role.customScope, input.classification)) throw forbidden();
      const meta = workRequestTransitionRequestMetadata();
      const result = await this.revisions.request(
        id,
        actor.id,
        memberId(actor, admin),
        { ...input, ...meta },
        admin,
      );
      if (result.event)
        await this.publish(id, actor.id, result.event, meta.correlationId);
      return result.revision;
    }, { isolationLevel: 'Serializable' });
  }
  resubmit(id: string, revisionId: string, _input: ResubmitWorkRequestRouteRevisionDto, actor: SessionActor) {
    return this.uow.execute(async () => {
      const admin = hasTenantWideInternalAuthority(actor);
      const result = await this.revisions.resubmit(
        id,
        revisionId,
        actor.id,
        memberId(actor, admin),
        actor.role.customScope,
        admin,
      );
      await this.publish(id, actor.id, result.event, workRequestTransitionRequestMetadata().correlationId);
      return result.revision;
    }, { isolationLevel: 'Serializable' });
  }
  private publish(id: string, actorId: string, event: { id: string; action: string; occurredAt: Date }, correlationId: string | undefined) {
    return this.outbox.enqueue(new WorkRequestTransitioned(
      { tenantId: RequestContext.requireTenantId(), actorId, eventId: event.id, occurredAt: event.occurredAt.toISOString(), correlationId },
      { workRequestId: id, action: event.action, priorState: '', resultingState: '' },
    ));
  }
}

function memberId(actor: SessionActor, admin: boolean) {
  if (admin) return null;
  if (!actor.member?.id) throw new Error('WR_ROUTE_MEMBER');
  return actor.member.id;
}
function scopeAllows(scope: CustomRoleScope | null, classification: Classification) {
  if (scope === null) return false;
  if (classification === Classification.CROSS_DIVISION_FORMAL)
    return scope === CustomRoleScope.company || scope === CustomRoleScope.division;
  if (classification === Classification.INTERNAL_TEAM)
    return scope === CustomRoleScope.company || scope === CustomRoleScope.division || scope === CustomRoleScope.team;
  return scope === CustomRoleScope.company || scope === CustomRoleScope.division || scope === CustomRoleScope.team || scope === CustomRoleScope.member;
}
function forbidden() {
  return new AppException({ code: AppErrorCode.Forbidden, status: 403, message: "You don't have permission to perform this action." });
}
