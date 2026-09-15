import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class TenantRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  async isActive(tenantId: string): Promise<boolean> {
    return this.transaction(async (db) => {
      const tenant = await db.tenant.findFirst({
        where: { id: tenantId, isActive: true },
        select: { id: true },
      });
      return tenant !== null;
    });
  }
}
