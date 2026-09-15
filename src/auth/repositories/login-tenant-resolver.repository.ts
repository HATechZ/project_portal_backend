import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export interface ResolvedLoginTenant {
  tenantId: string;
}

interface LoginTenantRow {
  tenant_id: string;
}

@Injectable()
export class LoginTenantResolverRepository {
  constructor(private readonly unitOfWork: UnitOfWorkService) {}

  resolve(normalizedEmail: string): Promise<ResolvedLoginTenant | null> {
    return this.unitOfWork.executeLoginResolution(async (db) => {
      const rows = await db.$queryRaw<LoginTenantRow[]>(Prisma.sql`
        SELECT tenant_id
        FROM public.resolve_user_login_email(${normalizedEmail}::text)
      `);
      return rows.length === 1 ? { tenantId: rows[0].tenant_id } : null;
    });
  }
}
