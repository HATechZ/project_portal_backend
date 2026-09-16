import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class MemberRemovalRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  remove(id: string, companyId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const member = await db.member.findFirst({
        where: { id, tenantId, companyId, isActive: true },
        select: { id: true, userId: true },
      });
      if (!member) {
        throw new AppException({
          code: AppErrorCode.NotFound,
          status: HttpStatus.NOT_FOUND,
          message: 'Member not found. It may have been removed or you may not have access to it.',
        });
      }
      const [activeDivisionLead, activeTeamLead] = await Promise.all([
        db.divisionLead.findFirst({
          where: { tenantId, memberId: id, revokedAt: null },
          select: { id: true },
        }),
        db.team.findFirst({
          where: { tenantId, leadMemberId: id, isActive: true },
          select: { id: true },
        }),
      ]);
      if (activeDivisionLead || activeTeamLead) {
        throw new AppException({
          code: AppErrorCode.Conflict,
          status: HttpStatus.CONFLICT,
          message: 'This member cannot be deleted because related records still depend on it. Remove or reassign those records first.',
        });
      }

      await db.teamMember.updateMany({
        where: { tenantId, memberId: id, leftAt: null },
        data: { leftAt: new Date() },
      });
      const profiles = await db.actorProfile.findMany({
        where: { tenantId, memberId: id },
        select: { id: true, roleId: true, userId: true },
      });
      await db.actorProfile.updateMany({
        where: { tenantId, memberId: id, isActive: true },
        data: { isActive: false, isDefault: false },
      });
      await db.member.update({
        where: { id_tenantId: { id, tenantId } },
        data: { isActive: false, updatedAt: new Date() },
      });

      if (!member.userId) return;
      const memberRoleIds = [...new Set(profiles.filter((profile) => profile.userId === member.userId).map((profile) => profile.roleId))];
      const otherProfiles = await db.actorProfile.findMany({
        where: {
          tenantId,
          userId: member.userId,
          isActive: true,
          role: {
            userRolesByRoleId: {
              some: { tenantId, userId: member.userId, revokedAt: null },
            },
          },
          OR: [
            { member: { is: { isActive: true } } },
            { clientContact: { is: { isActive: true } } },
          ],
        },
        select: { id: true, roleId: true },
      });
      const otherRoleIds = new Set(otherProfiles.map((profile) => profile.roleId));
      const roleIdsToRevoke = memberRoleIds.filter((roleId) => !otherRoleIds.has(roleId));
      if (roleIdsToRevoke.length) {
        await db.userRole.updateMany({
          where: { tenantId, userId: member.userId, roleId: { in: roleIdsToRevoke }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await db.authSession.updateMany({
        where: { tenantId, userId: member.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (otherProfiles.length === 0) {
        await db.user.update({
          where: { id: member.userId, tenantId },
          data: { isActive: false, updatedAt: new Date() },
        });
      }
    });
  }
}
