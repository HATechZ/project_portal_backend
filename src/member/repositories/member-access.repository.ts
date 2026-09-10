import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { linkMemberUserActorProfile } from '../../common/security/actor-access-orchestration';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { Prisma } from '../../generated/prisma/client';
import { MemberRecord, memberSelect } from './member.records';

@Injectable()
export class MemberAccessRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  linkExistingAccess(input: {
    memberId: string;
    companyId: string;
    userId: string;
    actorProfileId?: string;
  }): Promise<MemberRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const member = await db.member.findFirst({
          where: { id: input.memberId, tenantId, companyId: input.companyId },
          select: { id: true, userId: true },
        });
        if (!member) throw this.notFound('Member was not found');
        if (member.userId && member.userId !== input.userId) {
          throw this.conflict('Member is already linked to a different User');
        }
        if (input.actorProfileId) {
          await linkMemberUserActorProfile(db, {
            tenantId,
            companyId: input.companyId,
            memberId: input.memberId,
            userId: input.userId,
            actorProfileId: input.actorProfileId,
          });
        } else {
          const user = await db.user.findFirst({
            where: { id: input.userId, tenantId },
            select: { id: true },
          });
          if (!user) throw this.notFound('User was not found');
          await db.member.update({
            where: { id_tenantId: { id: member.id, tenantId } },
            data: { userId: input.userId, updatedAt: new Date() },
          });
        }

        const linked = await db.member.findFirst({
          where: { id: member.id, tenantId, companyId: input.companyId },
          select: memberSelect,
        });
        if (!linked) throw this.notFound('Member was not found');
        return linked;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private notFound(message: string): AppException {
    return new AppException({
      code: AppErrorCode.NotFound,
      message,
      status: 404,
    });
  }

  private conflict(message: string): AppException {
    return new AppException({
      code: AppErrorCode.Conflict,
      message,
      status: 409,
    });
  }
}
