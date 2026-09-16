import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

const actorProfileSelect = {
  id: true,
  roleId: true,
  memberId: true,
  clientContactId: true,
  label: true,
  isDefault: true,
  isActive: true,
  role: {
    select: { customCode: true, systemRole: { select: { systemCode: true } } },
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
    return this.transaction((db) =>
      db.actorProfile.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: actorProfileSelect,
      }),
    );
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
              userRolesByRoleId: {
                some: { tenantId, userId, revokedAt: null },
              },
            },
          },
          select: { id: true },
        });
        if (!eligible) return null;

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
