import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { ensureUserRoleAndRoleOnlyProfile } from '../../common/security/actor-access-orchestration';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  MemberMutationInput,
  MemberRecord,
  ScopedCompanyRecord,
  ScopedDivisionRecord,
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

const disallowedMemberOnboardingRoles = new Set<ActorRoleCode>([
  ActorRoleCode.client_owner,
]);

export interface MemberOnboardingInput {
  name: string;
  email: string;
  passwordHash: string;
  divisionId: string;
  roleId: string;
  assignedByUserId: string;
  designation?: string;
  phone?: string;
}

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
        where: { tenantId, companyId, divisionId: { in: divisionIds } },
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
        where: { tenantId, companyId, divisionId: { in: divisionIds } },
      }),
    );
  }

  findById(id: string, companyId: string): Promise<MemberRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.member.findFirst({
        where: { id, tenantId, companyId },
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
          roleTitle: input.roleTitle.trim(),
          isActive: input.isActive,
        },
        select: memberSelect,
      }),
    );
  }

  createWithAccess(
    companyId: string,
    input: MemberOnboardingInput,
  ): Promise<MemberRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const role = await db.role.findUnique({
          where: { id: input.roleId },
          select: { id: true, name: true, code: true },
        });
        if (!role) throw this.notFound('Role was not found');
        if (disallowedMemberOnboardingRoles.has(role.code)) {
          throw this.conflict('Role is not eligible for Member onboarding');
        }

        const userId = randomUUID();
        await db.user.create({
          data: {
            id: userId,
            tenantId,
            fullName: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            passwordHash: input.passwordHash,
            ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          },
          select: { id: true },
        });

        const member = await db.member.create({
          data: {
            tenantId,
            id: randomUUID(),
            userId,
            companyId,
            divisionId: input.divisionId,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            roleTitle: (input.designation?.trim() || role.name).trim(),
            isActive: true,
          },
          select: memberSelect,
        });

        await ensureUserRoleAndRoleOnlyProfile(db, {
          tenantId,
          userId,
          roleId: role.id,
          assignedByUserId: input.assignedByUserId,
          memberId: member.id,
        });

        const onboarded = await db.member.findFirst({
          where: { id: member.id, tenantId, companyId },
          select: memberSelect,
        });
        if (!onboarded) throw this.notFound('Member was not found');
        return onboarded;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
          ...(input.roleTitle !== undefined
            ? { roleTitle: input.roleTitle.trim() }
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

  private notFound(message: string): AppException {
    return new AppException({
      code: AppErrorCode.NotFound,
      status: 404,
      message,
    });
  }

  private conflict(message: string): AppException {
    return new AppException({
      code: AppErrorCode.Conflict,
      status: 409,
      message,
    });
  }
}
