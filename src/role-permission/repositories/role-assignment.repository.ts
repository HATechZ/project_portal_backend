import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppException } from '../../common/exceptions/app-exception';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import { ensureUserRoleAndRoleOnlyProfile } from '../../common/security/actor-access-orchestration';
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
    teamId?: string,
  ): Promise<UserRoleAssignment> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        if (teamId) {
          throw new AppException({
            code: AppErrorCode.BadRequest,
            status: HttpStatus.BAD_REQUEST,
            message: 'Role assignment scope does not accept a Team binding.',
          });
        }
        const member = await this.requireAssignableMemberRole(
          db,
          userId,
          roleId,
        );
        const { assignmentId } = await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId,
          roleId,
          assignedByUserId,
          ...(member ? { memberId: member.id } : {}),
          ...(teamId ? { teamId } : {}),
        });
        return db.userRole.findUniqueOrThrow({
          where: { id: assignmentId, tenantId },
          select: assignmentSelect(tenantId),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  reassign(
    userId: string,
    currentRoleId: string,
    newRoleId: string,
    assignedByUserId: string,
  ): Promise<UserRoleAssignment> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const member = await this.requireAssignableMemberRole(
          db,
          userId,
          newRoleId,
        );
        const current = await db.userRole.findFirst({
          where: {
            tenantId,
            userId,
            roleId: currentRoleId,
            revokedAt: null,
            role: { isSystemRole: false },
          },
          select: { id: true },
        });
        if (!current)
          throw new AppException({
            code: AppErrorCode.NotFound,
            status: HttpStatus.NOT_FOUND,
            message: 'The current active role assignment was not found.',
          });
        if (currentRoleId === newRoleId) {
          return db.userRole.findUniqueOrThrow({
            where: { id: current.id, tenantId },
            select: assignmentSelect(tenantId),
          });
        }
        await db.userRole.update({
          where: { id: current.id, tenantId },
          data: { revokedAt: new Date() },
        });
        const { assignmentId } = await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId,
          roleId: newRoleId,
          assignedByUserId,
          memberId: member.id,
        });
        return db.userRole.findUniqueOrThrow({
          where: { id: assignmentId, tenantId },
          select: assignmentSelect(tenantId),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async requireAssignableMemberRole(
    db: PrismaExecutor,
    userId: string,
    roleId: string,
  ): Promise<{ id: string }> {
    const tenantId = RequestContext.requireTenantId();
    const role = await db.role.findFirst({
      where: { id: roleId, tenantId, isSystemRole: false, isActive: true },
      select: {
        customScope: true,
        rolePermissions: {
          where: { tenantId, revokedAt: null },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!role || !role.customScope || role.rolePermissions.length === 0)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Only an active, permissioned custom role can be assigned to a Member.',
      });
    const member = await db.member.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
        user: { isActive: true, tenantId },
        division: { isActive: true },
        company: { isActive: true },
      },
      select: { id: true },
    });
    if (!member)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'An active same-Tenant Member linked to this User is required.',
      });
    return member;
  }
}
