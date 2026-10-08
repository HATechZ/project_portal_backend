import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { SessionActor } from '../../common/security/session.types';
import {
  ScopedCompanyRecord,
  ScopedDivisionRecord,
  TeamCreateInput,
  TeamMemberEligibilityRecord,
  TeamRecord,
  teamSelect,
} from './team.records';

@Injectable()
export class TeamRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findScopedCompany(): Promise<ScopedCompanyRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.company.findUnique({ where: { tenantId }, select: { id: true } }),
    );
  }

  findDivision(
    id: string,
    companyId: string,
  ): Promise<ScopedDivisionRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.findUnique({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
        select: { id: true, companyId: true },
      }),
    );
  }

  findCompanyDivisionIds(companyId: string): Promise<string[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const divisions = await db.division.findMany({
        where: { tenantId, companyId },
        select: { id: true },
      });
      return divisions.map((division) => division.id);
    });
  }

  findAll(
    companyId: string,
    divisionIds: string[],
    { skip, take }: PaginationArgs,
    allowedTeamIds?: string[],
  ): Promise<TeamRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.team.findMany({
        where: {
          tenantId,
          companyId,
          divisionId: { in: divisionIds },
          ...(allowedTeamIds ? { id: { in: allowedTeamIds } } : {}),
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: teamSelect,
      }),
    );
  }

  count(companyId: string, divisionIds: string[], allowedTeamIds?: string[]): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.team.count({
        where: { tenantId, companyId, divisionId: { in: divisionIds }, ...(allowedTeamIds ? { id: { in: allowedTeamIds } } : {}) },
      }),
    );
  }

  async findVisibleIds(companyId: string, actor: SessionActor): Promise<string[] | undefined> {
    if (actor.role.customScope === 'company' || actor.role.systemRole?.systemCode === 'tenant_super_admin') return undefined;
    const member = actor.member;
    if (!member?.isActive || !member.company.isActive) return [];
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      if (actor.role.customScope === 'division') {
        const divisionIds = member.divisionLeadsByMemberId.map(({ divisionId }) => divisionId);
        const teams = await db.team.findMany({ where: { tenantId, companyId, divisionId: { in: divisionIds } }, select: { id: true } });
        return teams.map(({ id }) => id);
      }
      if (actor.role.customScope === 'team') {
        const teams = await db.team.findMany({ where: { tenantId, companyId, leadMemberId: member.id }, select: { id: true } });
        return teams.map(({ id }) => id);
      }
      if (actor.role.customScope === 'member') {
        const teams = await db.teamMember.findMany({ where: { tenantId, memberId: member.id, leftAt: null, team: { companyId, isActive: true } }, select: { teamId: true } });
        return teams.map(({ teamId }) => teamId);
      }
      return [];
    });
  }

  async findVisibleById(id: string, companyId: string, actor: SessionActor): Promise<TeamRecord | null> {
    const ids = await this.findVisibleIds(companyId, actor);
    if (ids && !ids.includes(id)) return null;
    return this.findById(id, companyId);
  }

  findById(id: string, companyId: string): Promise<TeamRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.team.findFirst({
        where: { id, tenantId, companyId },
        select: teamSelect,
      }),
    );
  }

  findMember(
    id: string,
    companyId: string,
  ): Promise<TeamMemberEligibilityRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.findFirst({
        where: { id, tenantId, companyId },
        select: { id: true, companyId: true, divisionId: true, isActive: true },
      }),
    );
  }

  create(companyId: string, input: TeamCreateInput): Promise<TeamRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.team.create({
        data: {
          tenantId,
          id: randomUUID(),
          companyId,
          divisionId: input.divisionId,
          name: input.name.trim(),
          ...(input.leadMemberId ? { leadMemberId: input.leadMemberId } : {}),
        },
        select: teamSelect,
      }),
    );
  }

  updateName(id: string, companyId: string, name: string): Promise<TeamRecord> {
    void companyId;
    return this.transaction((db) =>
      db.team.update({
        where: { id },
        data: { name: name.trim(), updatedAt: new Date() },
        select: teamSelect,
      }),
    );
  }

  assignLead(
    id: string,
    companyId: string,
    leadMemberId: string,
  ): Promise<TeamRecord> {
    void companyId;
    return this.transaction((db) =>
      db.team.update({
        where: { id },
        data: { leadMemberId, updatedAt: new Date() },
        select: teamSelect,
      }),
    );
  }

  async hasAnyMembership(teamId: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const row = await db.teamMember.findFirst({
        where: { tenantId, teamId },
        select: { id: true },
      });
      return row !== null;
    });
  }

  delete(id: string): Promise<void> {
    return this.transaction(async (db) => {
      await db.team.delete({ where: { id } });
    });
  }
}
