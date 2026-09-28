import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class WorkRequestAssignmentReadRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  history(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Assignment.findMany({
        where: { tenantId, workRequestId },
        orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          level: true,
          divisionId: true,
          teamId: true,
          memberId: true,
          assignedAt: true,
          unassignedAt: true,
          replacedAt: true,
          note: true,
          assignedByActor: { select: { id: true, label: true } },
        },
      }),
    );
  }
}
