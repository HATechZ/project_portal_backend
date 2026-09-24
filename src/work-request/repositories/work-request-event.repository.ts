import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class WorkRequestEventRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  events(workRequestId: string, skip: number, take: number) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Event.findMany({
        where: { tenantId, workRequestId },
        skip,
        take,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          action: true,
          priorState: true,
          resultingState: true,
          note: true,
          occurredAt: true,
          performedByActor: { select: { id: true, label: true } },
        },
      }),
    );
  }
  count(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Event.count({ where: { tenantId, workRequestId } }),
    );
  }
}
