import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { TeamMemberRecord, teamMemberSelect } from './team.records';

@Injectable()
export class TeamMembershipRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  listMembers(
    teamId: string,
    includeEnded: boolean,
  ): Promise<TeamMemberRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.teamMember.findMany({
        where: { tenantId, teamId, ...(includeEnded ? {} : { leftAt: null }) },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: teamMemberSelect,
      }),
    );
  }

  findActiveMembership(
    teamId: string,
    memberId: string,
  ): Promise<TeamMemberRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.teamMember.findFirst({
        where: { tenantId, teamId, memberId, leftAt: null },
        select: teamMemberSelect,
      }),
    );
  }

  addMember(
    teamId: string,
    memberId: string,
    teamRole?: string,
  ): Promise<TeamMemberRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.teamMember.create({
        data: {
          tenantId,
          id: randomUUID(),
          teamId,
          memberId,
          ...(teamRole !== undefined ? { teamRole: teamRole.trim() } : {}),
        },
        select: teamMemberSelect,
      }),
    );
  }

  endMember(teamId: string, memberId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const active = await db.teamMember.findFirst({
        where: { tenantId, teamId, memberId, leftAt: null },
        select: { id: true },
      });
      if (!active) return;
      await db.teamMember.update({
        where: { id: active.id },
        data: { leftAt: new Date() },
      });
    });
  }
}
