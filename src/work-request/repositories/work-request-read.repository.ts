import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { workRequestSelect } from './work-request.records';

@Injectable()
export class WorkRequestReadRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  list(skip: number, take: number) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: workRequestSelect,
      }),
    );
  }
  count() {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.count({
        where: { tenantId },
      }),
    );
  }
  find(id: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findFirst({
        where: { id, tenantId },
        select: workRequestSelect,
      }),
    );
  }
}
