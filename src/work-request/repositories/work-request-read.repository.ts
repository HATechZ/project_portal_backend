import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { workRequestSelect } from './work-request.records';
import type { SessionActor } from '../../common/security/session.types';
import { workRequestVisibilityWhere } from '../../common/security/work-request-visibility';

@Injectable()
export class WorkRequestReadRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  list(skip: number, take: number, actor: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findMany({
        where: { tenantId, ...workRequestVisibilityWhere(actor) },
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: workRequestSelect,
      }),
    );
  }
  count(actor: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.count({
        where: { tenantId, ...workRequestVisibilityWhere(actor) },
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
}
