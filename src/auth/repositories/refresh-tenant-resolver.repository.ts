import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export interface ResolvedRefreshTenant {
  tenantId: string;
}

interface RefreshTenantRow {
  tenant_id: string;
}

@Injectable()
export class RefreshTenantResolverRepository {
  constructor(private readonly unitOfWork: UnitOfWorkService) {}

  resolve(refreshTokenHash: string): Promise<ResolvedRefreshTenant | null> {
    return this.unitOfWork.executeRefreshResolution(async (db) => {
      const rows = await db.$queryRaw<RefreshTenantRow[]>(Prisma.sql`
        SELECT tenant_id
        FROM public.resolve_refresh_token_tenant(${refreshTokenHash}::text)
      `);
      return rows.length === 1 ? { tenantId: rows[0].tenant_id } : null;
    });
  }
}
