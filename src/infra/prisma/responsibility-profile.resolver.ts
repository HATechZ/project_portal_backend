import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { CustomRoleScope, Prisma } from '../../generated/prisma/client';
import type {
  ResponsibilityProfileContext,
  ResponsibilityProfileResolverPort,
} from '../../contracts/responsibility-profile-resolver.port';
import { UnitOfWorkService } from './unit-of-work.service';

@Injectable()
export class ResponsibilityProfileResolver implements ResponsibilityProfileResolverPort {
  constructor(private readonly uow: UnitOfWorkService) {}

  async resolve(
    input: ResponsibilityProfileContext,
    tx: Prisma.TransactionClient,
  ): Promise<{
    actorProfileId: string;
    sourceUserId: string;
    sourceRoleId: string;
    sourceMemberId: string;
  }> {
    if (
      input.tenantId !== RequestContext.requireTenantId() ||
      !this.uow.inTransaction ||
      !Object.is(this.uow.client, tx)
    )
      throw new Error(
        'Responsibility identity requires the active tenant transaction.',
      );
    // Lock the identity owner before reading profiles: the User lock also
    // serializes new UserRole/ActorProfile foreign-key references.
    await tx.$queryRaw(Prisma.sql`
      SELECT m.id FROM members m
      JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
      WHERE m.id = ${input.memberId}::uuid AND m.tenant_id = ${input.tenantId}::uuid
      FOR UPDATE OF u, m
    `);
    const member = await tx.member.findFirst({
      where: {
        id: input.memberId,
        tenantId: input.tenantId,
        isActive: true,
        company: { is: { isActive: true } },
        user: { is: { isActive: true } },
      },
      select: { id: true, userId: true, companyId: true },
    });
    if (!member?.userId) throw unresolved();
    // Stable order prevents competing responsibility assignments from taking
    // their identity and grant locks in different orders.
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM actor_profiles
      WHERE tenant_id = ${input.tenantId}::uuid AND user_id = ${member.userId}::uuid
      ORDER BY id FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT r.id FROM roles r
      WHERE r.id IN (
        SELECT a.role_id FROM actor_profiles a
        WHERE a.tenant_id = ${input.tenantId}::uuid AND a.user_id = ${member.userId}::uuid
      ) ORDER BY r.id FOR UPDATE OF r
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM user_roles
      WHERE tenant_id = ${input.tenantId}::uuid AND user_id = ${member.userId}::uuid
      ORDER BY id FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT rp.id FROM role_permissions rp
      WHERE rp.tenant_id = ${input.tenantId}::uuid AND rp.role_id IN (
        SELECT a.role_id FROM actor_profiles a
        WHERE a.tenant_id = ${input.tenantId}::uuid AND a.user_id = ${member.userId}::uuid
      ) ORDER BY rp.id FOR UPDATE OF rp
    `);
    const cycle = await tx.workRequestDivisionCycle.findFirst({
      where: {
        id: input.divisionCycleId,
        tenantId: input.tenantId,
        routeId: input.routeId,
        route: { is: { workRequestId: input.workRequestId } },
      },
      select: { routeStep: { select: { divisionId: true } } },
    });
    if (!cycle?.routeStep.divisionId) throw unresolved();
    const scope =
      input.responsibilityType === 'TEAM'
        ? CustomRoleScope.team
        : CustomRoleScope.division;
    let teamId: string | undefined;
    if (input.responsibilityType === 'TEAM') {
      await tx.$queryRaw(Prisma.sql`
        SELECT ts.id FROM work_request_team_steps ts
        JOIN teams t ON t.id = ts.team_id AND t.tenant_id = ts.tenant_id
        WHERE ts.id = ${input.teamStepId}::uuid AND ts.tenant_id = ${input.tenantId}::uuid
          AND ts.route_id = ${input.routeId}::uuid AND ts.division_cycle_id = ${input.divisionCycleId}::uuid
        FOR UPDATE OF ts, t
      `);
      const step = await tx.workRequestTeamStep.findFirst({
        where: {
          id: input.teamStepId,
          tenantId: input.tenantId,
          routeId: input.routeId,
          divisionCycleId: input.divisionCycleId,
          activatedAt: { not: null },
          completedAt: null,
          team: {
            is: {
              leadMemberId: member.id,
              isActive: true,
              companyId: member.companyId,
              divisionId: cycle.routeStep.divisionId,
            },
          },
        },
        select: { teamId: true },
      });
      if (!step) throw unresolved();
      teamId = step.teamId;
    } else {
      await tx.$queryRaw(Prisma.sql`
        SELECT dc.id FROM work_request_division_cycles dc
        JOIN division_leads dl ON dl.id = ${input.divisionLeadId}::uuid AND dl.tenant_id = dc.tenant_id
        WHERE dc.id = ${input.divisionCycleId}::uuid AND dc.tenant_id = ${input.tenantId}::uuid
          AND dc.route_id = ${input.routeId}::uuid
        FOR UPDATE OF dc, dl
      `);
      const lead = await tx.divisionLead.findFirst({
        where: {
          id: input.divisionLeadId,
          tenantId: input.tenantId,
          companyId: member.companyId,
          divisionId: cycle.routeStep.divisionId,
          memberId: member.id,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!lead) throw unresolved();
    }
    const profiles = await tx.actorProfile.findMany({
      where: {
        tenantId: input.tenantId,
        memberId: member.id,
        userId: member.userId,
        isActive: true,
        role: {
          is: {
            isActive: true,
            customScope: scope,
            userRolesByRoleId: {
              some: {
                tenantId: input.tenantId,
                userId: member.userId,
                revokedAt: null,
                ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}),
              },
            },
            rolePermissions: {
              some: {
                tenantId: input.tenantId,
                revokedAt: null,
                permission: {
                  is: {
                    code: input.requiredPermission,
                    scopeCompatibilities: { some: { scope } },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, roleId: true },
      take: 2,
    });
    if (profiles.length !== 1) throw unresolved();
    return {
      actorProfileId: profiles[0].id,
      sourceRoleId: profiles[0].roleId,
      sourceUserId: member.userId,
      sourceMemberId: member.id,
    };
  }
}

function unresolved(): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message:
      'The responsible actor cannot be uniquely resolved for this Work Request.',
  });
}
