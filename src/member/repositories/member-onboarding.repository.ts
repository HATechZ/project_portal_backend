import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { Prisma } from '../../generated/prisma/client';
import { MemberRecord, memberSelect } from './member.records';

export interface MemberOnboardingInput {
  name: string;
  email: string;
  passwordHash: string;
  divisionId: string;
  designationId: string;
  phone?: string;
}

/** V1 atomic onboarding: linked User and Member only; role access is assigned later. */
@Injectable()
export class MemberOnboardingRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  createWithAccess(
    companyId: string,
    input: MemberOnboardingInput,
  ): Promise<MemberRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const userId = randomUUID();
        await db.user.create({
          data: {
            id: userId,
            tenantId,
            fullName: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            passwordHash: input.passwordHash,
            ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          },
          select: { id: true },
        });

        const member = await db.member.create({
          data: {
            tenantId,
            id: randomUUID(),
            userId,
            companyId,
            divisionId: input.divisionId,
            designationId: input.designationId,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            isActive: true,
          },
          select: memberSelect,
        });

        return member;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
