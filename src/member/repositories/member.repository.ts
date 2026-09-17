import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  MemberMutationInput,
  MemberRecord,
  ScopedCompanyRecord,
  ScopedDivisionRecord,
  memberDivisionSelect,
  memberSelect,
} from './member.records';

export const auditedMemberRelations = [
  'actorProfilesByMemberId',
  'teamsByLeadMemberId',
  'teamMembersByMemberId',
  'workRequestAssignmentsByMemberId',
  'workflowInfoRequestsByRequestedByMemberId',
  'workflowInfoRequestsByTargetMemberId',
  'workRequestRevisionRequestsByRequestedToMemberId',
] as const;

@Injectable()
export class MemberRepository extends BaseRepository {
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

  /**
   * Divisions this Member actively leads. Revoked rows are never returned —
   * they are retained history, not current authority (04.1.1 DR-06).
   */
  findLedDivisions(
    memberId: string,
    companyId: string,
  ): Promise<{ id: string; name: string; abbr: string; assignedAt: Date }[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const rows = await db.divisionLead.findMany({
        where: { tenantId, companyId, memberId, revokedAt: null },
        select: {
          assignedAt: true,
          division: { select: memberDivisionSelect },
        },
        orderBy: [{ division: { name: 'asc' } }, { divisionId: 'asc' }],
      });
      return rows.map((row) => ({
        ...row.division,
        assignedAt: row.assignedAt,
      }));
    });
  }

  findCompanyDivisionIds(companyId: string): Promise<string[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const divisions = await db.division.findMany({
        where: { tenantId, companyId },
        select: { id: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return divisions.map((division) => division.id);
    });
  }

  findLedTeamDivisionId(
    leadMemberId: string,
    actorProfileId: string,
  ): Promise<string | null> {
    const tenantId = RequestContext.requireTenantId();
    void actorProfileId;
    return this.transaction(async (db) => {
      const team = await db.team.findFirst({
        where: { tenantId, leadMemberId },
        select: { divisionId: true },
        orderBy: { id: 'asc' },
      });
      return team?.divisionId ?? null;
    });
  }

  findAll(
    companyId: string,
    divisionIds: string[],
    { skip, take }: PaginationArgs,
  ): Promise<MemberRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.findMany({
        where: {
          tenantId,
          companyId,
          isActive: true,
          divisionId: { in: divisionIds },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: memberSelect,
      }),
    );
  }

  count(companyId: string, divisionIds: string[]): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.count({
        where: {
          tenantId,
          companyId,
          isActive: true,
          divisionId: { in: divisionIds },
        },
      }),
    );
  }

  findById(id: string, companyId: string): Promise<MemberRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.findFirst({
        where: { id, tenantId, companyId, isActive: true },
        select: memberSelect,
      }),
    );
  }

  create(companyId: string, input: Required<MemberMutationInput>) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.create({
        data: {
          tenantId,
          id: randomUUID(),
          companyId,
          divisionId: input.divisionId,
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          roleTitle: input.designation.trim(),
          isActive: input.isActive,
        },
        select: memberSelect,
      }),
    );
  }

  update(id: string, companyId: string, input: MemberMutationInput) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.update({
        where: { id_tenantId: { id, tenantId } },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.email !== undefined
            ? { email: input.email.trim().toLowerCase() }
            : {}),
          ...(input.designation !== undefined
            ? { roleTitle: input.designation.trim() }
            : {}),
          ...(input.divisionId !== undefined
            ? { divisionId: input.divisionId }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedAt: new Date(),
        },
        select: memberSelect,
      }),
    ).then((member) => (member.companyId === companyId ? member : member));
  }

  delete(id: string, companyId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.member.delete({ where: { id_tenantId: { id, tenantId } } });
      void companyId;
    });
  }
}
