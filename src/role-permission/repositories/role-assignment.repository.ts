import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  assignmentSelect,
  UserRoleAssignment,
} from './role-permission.repository';

@Injectable()
export class RoleAssignmentRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  ensureAssignment(
    userId: string,
    roleId: string,
    assignedByUserId: string,
  ): Promise<UserRoleAssignment> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      // The User row serializes assignment/profile creation, including retries.
      await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      await db.user.findUniqueOrThrow({
        where: { id: userId, tenantId },
        select: { id: true },
      });
      const role = await db.role.findUniqueOrThrow({
        where: { id: roleId },
        select: { name: true },
      });
      const existing = await db.userRole.findFirst({
        where: { tenantId, userId, roleId, revokedAt: null },
        select: assignmentSelect(tenantId),
      });
      const assignment =
        existing ??
        (await db.userRole.create({
          data: {
            id: randomUUID(),
            tenantId,
            userId,
            roleId,
            assignedByUserId,
          },
          select: assignmentSelect(tenantId),
        }));
      const validDefault = await db.actorProfile.findFirst({
        where: {
          tenantId,
          userId,
          isDefault: true,
          isActive: true,
          role: {
            userRolesByRoleId: { some: { tenantId, userId, revokedAt: null } },
          },
        },
        select: { id: true },
      });
      const profile = await db.actorProfile.findFirst({
        where: {
          tenantId,
          userId,
          roleId,
          memberId: null,
          clientContactId: null,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!validDefault)
        await db.actorProfile.updateMany({
          where: { tenantId, userId, isDefault: true },
          data: { isDefault: false },
        });
      if (profile) {
        await db.actorProfile.update({
          where: { id: profile.id, tenantId },
          data: {
            isActive: true,
            ...(!validDefault ? { isDefault: true } : {}),
          },
        });
      } else {
        await db.actorProfile.create({
          data: {
            id: randomUUID(),
            tenantId,
            userId,
            roleId,
            label: role.name,
            isActive: true,
            isDefault: !validDefault,
          },
        });
      }
      return assignment;
    });
  }
}
