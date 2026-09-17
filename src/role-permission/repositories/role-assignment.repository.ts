import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppException } from '../../common/exceptions/app-exception';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { HttpStatus } from '@nestjs/common';
import { ensureUserRoleAndRoleOnlyProfile } from '../../common/security/actor-access-orchestration';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  assignmentSelect,
  UserRoleAssignment,
} from './role-permission.repository';
import { customRolePermissionCodes } from '../providers/custom-role-policy';

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
      const role = await db.role.findFirstOrThrow({
        where: { id: roleId, OR: [{ isSystemRole: true }, { tenantId }] },
        select: {
          isSystemRole: true,
          name: true,
          customScope: true,
          workflowActionRolePermissionsByRoleId: {
            where: {
              tenantId,
              allowed: true,
              action: {
                code: { in: customRolePermissionCodes('division') },
              },
            },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (
        !role.isSystemRole &&
        (role.workflowActionRolePermissionsByRoleId.length === 0 ||
          !['division', 'company'].includes(role.customScope ?? ''))
      ) {
        throw new AppException({
          code: AppErrorCode.BadRequest,
          status: HttpStatus.BAD_REQUEST,
          message: 'This custom role is not eligible for assignment.',
        });
      }
      const member = await db.member.findFirst({
        where: {
          tenantId,
          userId,
          isActive: true,
          division: { isActive: true },
          company: { isActive: true },
        },
        select: { id: true },
      });
      if (!role.isSystemRole && !member) {
        throw new AppException({
          code: AppErrorCode.BadRequest,
          status: HttpStatus.BAD_REQUEST,
          message:
            'This user needs an active Member record before this custom role can be assigned.',
        });
      }
      const { assignmentId } = await ensureUserRoleAndRoleOnlyProfile(db, {
        tenantId,
        userId,
        roleId,
        assignedByUserId,
        ...(member ? { memberId: member.id } : {}),
      });
      return db.userRole.findUniqueOrThrow({
        where: { id: assignmentId, tenantId },
        select: assignmentSelect(tenantId),
      });
    });
  }
}
