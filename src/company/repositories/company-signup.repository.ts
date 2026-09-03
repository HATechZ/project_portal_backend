import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export interface CompanyProvisioningInput {
  companyName: string;
  companyAbbr: string;
  companyTypeId: string;
  adminFullName: string;
  adminEmail: string;
  adminPasswordHash: string;
  adminCountry: string;
  adminPhone: string;
}

export interface CompanyProvisioningResult {
  companyId: string;
  userId: string;
}

interface ProvisioningRow {
  company_id: string;
  user_id: string;
}

@Injectable()
export class CompanySignupRepository {
  constructor(private readonly unitOfWork: UnitOfWorkService) {}

  provision(
    input: CompanyProvisioningInput,
  ): Promise<CompanyProvisioningResult> {
    return this.unitOfWork.executeProvisioning(async (db) => {
      const rows = await db.$queryRaw<ProvisioningRow[]>(Prisma.sql`
        SELECT company_id, user_id
        FROM public.provision_company_workspace(
          ${input.companyName}::text,
          ${input.companyAbbr}::text,
          ${input.companyTypeId}::uuid,
          ${input.adminFullName}::text,
          ${input.adminEmail}::text,
          ${input.adminPasswordHash}::text,
          ${input.adminCountry}::text,
          ${input.adminPhone}::text
        )
      `);
      if (rows.length !== 1) {
        throw new Error('Company workspace provisioning returned no result');
      }
      return { companyId: rows[0].company_id, userId: rows[0].user_id };
    });
  }
}
