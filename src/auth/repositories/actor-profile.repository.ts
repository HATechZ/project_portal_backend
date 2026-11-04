import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  isStaffStarterRoleCode,
  STAFF_STARTER_ROLE_CODE,
} from '../../common/security/starter-role-definition';

const actorProfileSelect = {
  id: true,
  roleId: true,
  memberId: true,
  clientContactId: true,
  label: true,
  isDefault: true,
  isActive: true,
  role: {
    select: {
      customCode: true,
      customScope: true,
      isSystemRole: true,
      systemRole: { select: { systemCode: true } },
    },
  },
} satisfies Prisma.ActorProfileSelect;

export type ActorProfileRecord = Prisma.ActorProfileGetPayload<{
  select: typeof actorProfileSelect;
}>;

@Injectable()
export class ActorProfileRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findForUser(userId: string): Promise<ActorProfileRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const profiles = await db.actorProfile.findMany({
        where: {
          tenantId,
          userId,
          isActive: true,
          role: {
            isActive: true,
            userRolesByRoleId: { some: { tenantId, userId, revokedAt: null } },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: actorProfileSelect,
      });
      const hasNonStaffCustomRole = profiles.some(
        (profile) =>
          !profile.role.isSystemRole &&
          !isStaffStarterRoleCode(profile.role.customCode),
      );
      return hasNonStaffCustomRole
        ? profiles.filter(
            (profile) => profile.role.customCode !== STAFF_STARTER_ROLE_CODE,
          )
        : profiles;
    });
  }

  setDefault(id: string, userId: string): Promise<ActorProfileRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (transaction) => {
        const eligible = await transaction.actorProfile.findFirst({
          where: {
            id,
            tenantId,
            userId,
            isActive: true,
            role: {
              isActive: true,
              userRolesByRoleId: {
                some: { tenantId, userId, revokedAt: null },
              },
            },
          },
          select: { id: true },
        });
        if (!eligible) return null;
        const hasNonStaffCustomRole = await transaction.actorProfile.findFirst({
          where: {
            tenantId,
            userId,
            isActive: true,
            role: {
              isActive: true,
              isSystemRole: false,
              customCode: { not: STAFF_STARTER_ROLE_CODE },
              userRolesByRoleId: {
                some: { tenantId, userId, revokedAt: null },
              },
            },
          },
          select: { id: true },
        });
        if (hasNonStaffCustomRole) {
          const selected = await transaction.actorProfile.findFirst({
            where: { id, tenantId, userId },
            select: { role: { select: { customCode: true } } },
          });
          if (isStaffStarterRoleCode(selected?.role?.customCode ?? null))
            return null;
        }

        await transaction.actorProfile.updateMany({
          where: { tenantId, userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        return transaction.actorProfile.update({
          where: { id, tenantId },
          data: { isDefault: true },
          select: actorProfileSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
