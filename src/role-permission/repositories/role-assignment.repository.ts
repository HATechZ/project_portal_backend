import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
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
  ): Promise<UserRoleAssignment> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const { assignmentId } = await ensureUserRoleAndRoleOnlyProfile(db, {
        tenantId,
        userId,
        roleId,
        assignedByUserId,
      });
      return db.userRole.findUniqueOrThrow({
        where: { id: assignmentId, tenantId },
        select: assignmentSelect(tenantId),
      });
    });
  }
}
