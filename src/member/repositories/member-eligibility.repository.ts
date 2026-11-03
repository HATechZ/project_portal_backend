import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { eligibleMemberSelect } from './member-eligibility.records';

@Injectable()
export class MemberEligibilityRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }
  findEligibilityTarget(divisionId?: string, teamId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      if (teamId)
        return db.team.findFirst({
          where: {
            id: teamId,
            tenantId,
            isActive: true,
            division: { isActive: true },
            company: { isActive: true },
          },
          select: { companyId: true, divisionId: true, leadMemberId: true },
        });
      const division = await db.division.findFirst({
        where: {
          id: divisionId,
          tenantId,
          isActive: true,
          company: { isActive: true },
        },
        select: { id: true, companyId: true },
      });
      return division
        ? {
            companyId: division.companyId,
            divisionId: division.id,
            leadMemberId: null,
          }
        : null;
    });
  }

  findEligibleMembers(companyId: string, divisionId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.findMany({
        where: { tenantId, companyId, divisionId, isActive: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: eligibleMemberSelect(tenantId, companyId, divisionId),
      }),
    );
  }
}
