import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class SessionAdministrationRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  revokeForUser(userId: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const users = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users WHERE id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      if (!users.length) return false;
      await db.authSession.updateMany({
        where: { tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
  }
}
