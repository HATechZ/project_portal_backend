import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { workRequestSelect } from './work-request.records';
import type { SessionActor } from '../../common/security/session.types';
import { workRequestVisibilityWhere } from '../../common/security/work-request-visibility';
import type { WorkRequestLifecycleFilter } from '../dtos/work-request-list-query.dto';

@Injectable()
export class WorkRequestReadRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  list(
    skip: number,
    take: number,
    actor: SessionActor,
    lifecycle: WorkRequestLifecycleFilter = 'active',
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findMany({
        where: {
          tenantId,
          ...workRequestVisibilityWhere(actor),
          ...lifecycleWhere(lifecycle),
        },
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: workRequestSelect,
      }),
    );
  }
  count(actor: SessionActor, lifecycle: WorkRequestLifecycleFilter = 'active') {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.count({
        where: {
          tenantId,
          ...workRequestVisibilityWhere(actor),
          ...lifecycleWhere(lifecycle),
        },
      }),
    );
  }
  find(id: string, actor: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findFirst({
        where: { id, tenantId, ...workRequestVisibilityWhere(actor) },
        select: workRequestSelect,
      }),
    );
  }
  findForClient(id: string, clientId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findFirst({
        where: {
          id,
          tenantId,
          OR: [
            { bid: { is: { clientId } } },
            { directProject: { is: { clientId } } },
          ],
        },
        select: workRequestSelect,
      }),
    );
  }
}

function lifecycleWhere(lifecycle: WorkRequestLifecycleFilter) {
  if (lifecycle === 'archived') return { archivedAt: { not: null } };
  if (lifecycle === 'all') return {};
  return { archivedAt: null };
}
