import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { roleSelect, type RoleRecord } from './role-permission.records';
import { customRolePermissionCodes } from '../providers/custom-role-policy';

@Injectable()
export class RoleOptionsRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  async findForUser(userId: string): Promise<RoleRecord[] | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const user = await db.user.findFirst({
        where: { id: userId, tenantId },
        select: {
          id: true,
          membersByUserId: {
            where: {
              tenantId,
              isActive: true,
              division: { isActive: true },
              company: { isActive: true },
            },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!user) return null;
      const assigned = await db.userRole.findMany({
        where: { tenantId, userId, revokedAt: null },
        select: { roleId: true },
      });
      const assignedIds = assigned.map(({ roleId }) => roleId);
      return db.role.findMany({
        where: {
          OR: [
            { isSystemRole: true },
            {
              tenantId,
              isSystemRole: false,
              customScope: { in: ['division', 'company'] },
              workflowActionRolePermissionsByRoleId: {
                some: {
                  tenantId,
                  allowed: true,
                  action: {
                    code: { in: customRolePermissionCodes('division') },
                  },
                },
              },
              ...(user.membersByUserId.length ? {} : { id: { in: [] } }),
            },
          ],
          id: { notIn: assignedIds },
        },
        orderBy: { name: 'asc' },
        select: roleSelect(tenantId),
      });
    });
  }
}
