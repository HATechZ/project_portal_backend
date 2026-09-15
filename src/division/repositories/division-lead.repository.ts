import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  ensureUserRoleAndRoleOnlyProfile,
  linkMemberUserActorProfile,
} from '../../common/security/actor-access-orchestration';
import { RequestContext } from '../../common/context/request-context';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { DivisionLeadAssignmentRecord } from './division-lead.records';

@Injectable()
export class DivisionLeadRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  assign(input: {
    companyId: string;
    divisionId: string;
    memberId: string;
    assignedByUserId: string;
  }): Promise<DivisionLeadAssignmentRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const division = await db.division.findUnique({
          where: {
            id_tenantId_companyId: {
              id: input.divisionId,
              tenantId,
              companyId: input.companyId,
            },
          },
          select: { id: true, name: true, abbr: true },
        });
        if (!division) throw this.notFound('Division was not found');

        const member = await db.member.findFirst({
          where: {
            id: input.memberId,
            tenantId,
            companyId: input.companyId,
            divisionId: input.divisionId,
            isActive: true,
          },
          select: { id: true, name: true, email: true, userId: true },
        });
        if (!member) {
          throw this.notFound('Member was not found in this Division');
        }
        if (!member.userId) {
          throw this.conflict(
            'Member must be linked to a User before assigning Division Lead',
          );
        }

        const role = await db.role.findUniqueOrThrow({
          where: { code: ActorRoleCode.division_lead },
          select: { id: true },
        });
        const { actorProfileId } = await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId: member.userId,
          roleId: role.id,
          assignedByUserId: input.assignedByUserId,
          memberId: member.id,
        });
        await linkMemberUserActorProfile(db, {
          tenantId,
          companyId: input.companyId,
          memberId: member.id,
          userId: member.userId,
          actorProfileId,
        });
        return {
          division,
          member: { ...member, userId: member.userId },
          roleCode: ActorRoleCode.division_lead,
          userRoleActive: true,
          actorProfileLinked: true,
        };
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
