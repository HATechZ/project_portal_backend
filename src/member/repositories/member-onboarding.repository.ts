import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { Prisma } from '../../generated/prisma/client';
import { MemberRecord, memberSelect } from './member.records';
import { ensureUserRoleAndRoleOnlyProfile } from '../../common/security/actor-access-orchestration';
import { AppException } from '../../common/exceptions/app-exception';
import { AppErrorCode } from '../../common/exceptions/app-error-code';

export interface MemberOnboardingInput {
  name: string;
  email: string;
  passwordHash: string;
  divisionId: string;
  designationId: string;
  phone?: string;
}

/** Atomic onboarding includes the protected, tenant-local Staff baseline. */
@Injectable()
export class MemberOnboardingRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  createWithAccess(
    companyId: string,
    input: MemberOnboardingInput,
    assignedByUserId: string,
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

        const staff = await db.role.findFirst({
          where: {
            tenantId,
            customCode: 'staff',
            customScope: 'member',
            isSystemRole: false,
            isActive: true,
          },
          select: { id: true },
        });
        if (!staff)
          throw new AppException({
            code: AppErrorCode.Conflict,
            status: 409,
            message: 'The protected Staff role is unavailable for this Tenant.',
          });
        await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId,
          roleId: staff.id,
          assignedByUserId,
          memberId: member.id,
        });

        return member;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
