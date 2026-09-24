import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type {
  WorkRequestParentScope,
  WorkRequestScope,
} from '../providers/work-request-resource-scope.provider';
import {
  type WorkRequestRecord,
  workRequestSelect,
} from './work-request.records';

@Injectable()
export class WorkRequestReadRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  list(skip: number, take: number, scope: WorkRequestScope) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findMany({
        where: { tenantId, ...this.scopedWhere(scope) },
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: workRequestSelect,
      }),
    );
  }
  count(scope: WorkRequestScope) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.count({
        where: { tenantId, ...this.scopedWhere(scope) },
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
  parentScope(record: WorkRequestRecord): WorkRequestParentScope {
    const parent = record.bid ?? record.directProject;
    if (!parent) throw new Error('WR_PARENT');
    return { clientId: parent.clientId, companyId: parent.client.companyId };
  }
  private scopedWhere(scope: WorkRequestScope): Prisma.WorkRequestV1WhereInput {
    if (scope.tenantWide) return {};
    if (scope.clientId)
      return {
        OR: [
          { bid: { clientId: scope.clientId } },
          { directProject: { clientId: scope.clientId } },
        ],
      };
    if (scope.companyId)
      return {
        OR: [
          { bid: { client: { companyId: scope.companyId } } },
          { directProject: { client: { companyId: scope.companyId } } },
        ],
      };
    return { id: { in: [] } };
  }
}
