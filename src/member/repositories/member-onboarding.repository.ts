import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { ensureUserRoleAndRoleOnlyProfile } from '../../common/security/actor-access-orchestration';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { MemberRecord, memberSelect } from './member.records';

const disallowedMemberOnboardingRoles = new Set<ActorRoleCode>([
  ActorRoleCode.client_owner,
]);

export interface MemberOnboardingInput {
  name: string;
  email: string;
  passwordHash: string;
  divisionId: string;
  roleId: string;
  assignedByUserId: string;
  designation?: string;
  phone?: string;
}

/** V1 atomic onboarding: User, Member, UserRole, and role-only ActorProfile in one transaction. */
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
        const role = await db.role.findFirst({
          where: {
            id: input.roleId,
            OR: [{ isSystemRole: true }, { tenantId }],
          },
          select: {
            id: true,
            name: true,
            systemRole: { select: { systemCode: true } },
          },
        });
        if (!role) throw this.notFound('Role was not found');
        if (
          role.systemRole &&
          disallowedMemberOnboardingRoles.has(role.systemRole.systemCode)
        ) {
          throw this.conflict('Role is not eligible for Member onboarding');
        }

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
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            roleTitle: (input.designation?.trim() || role.name).trim(),
            isActive: true,
          },
          select: memberSelect,
        });

        await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId,
          roleId: role.id,
          assignedByUserId: input.assignedByUserId,
          memberId: member.id,
        });

        const onboarded = await db.member.findFirst({
          where: { id: member.id, tenantId, companyId },
          select: memberSelect,
        });
        if (!onboarded) throw this.notFound('Member was not found');
        return onboarded;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private notFound(message: string): AppException {
    return new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message,
    });
  }

  private conflict(message: string): AppException {
    return new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message,
    });
  }
}
