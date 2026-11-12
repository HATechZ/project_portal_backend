import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../../config/configuration';
import { RequestContext } from '../../common/context/request-context';
import { PermissionCode } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';
import { UnitOfWorkService } from './unit-of-work.service';
import { ResponsibilityProfileResolver } from './responsibility-profile.resolver';
import type { ResponsibilityProfileContext } from '../../contracts/responsibility-profile-resolver.port';

const at = new Date('2026-01-01T00:00:00Z');
const input: ResponsibilityProfileContext = {
  tenantId: 'tenant-a',
  workRequestId: 'request-a',
  routeId: 'route-a',
  divisionCycleId: 'cycle-a',
  memberId: 'member-a',
  responsibilityType: 'TEAM',
  teamStepId: 'team-step-a',
  requiredPermission: PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
};
const profile = {
  id: 'actor-a',
  tenantId: 'tenant-a',
  memberId: 'member-a',
  userId: 'user-a',
  roleId: 'role-a',
  clientContactId: null,
  label: 'Actor',
  isDefault: true,
  isActive: true,
  createdAt: at,
};
function setup() {
  const prisma = new PrismaService(new ConfigService<AppConfiguration, true>());
  const uow = new UnitOfWorkService(prisma);
  const tx = prisma.scoped;
  jest.spyOn(uow, 'inTransaction', 'get').mockReturnValue(true);
  jest.spyOn(uow, 'client', 'get').mockReturnValue(tx);
  const locks = jest.spyOn(tx, '$queryRaw').mockResolvedValue([]);
  jest.spyOn(tx.member, 'findFirst').mockResolvedValue({
    id: 'member-a',
    tenantId: 'tenant-a',
    userId: 'user-a',
    companyId: 'company-a',
    divisionId: 'division-a',
    name: 'Member',
    email: 'test@example.test',
    designationId: 'designation-a',
    isActive: true,
    createdAt: at,
    updatedAt: at,
  });
  const cycle = {
    id: 'cycle-a',
    tenantId: 'tenant-a',
    routeId: 'route-a',
    routeStepId: 'route-step-a',
    activatedAt: at,
    completedAt: null,
    createdAt: at,
    routeStep: { divisionId: 'division-a' },
  };
  jest.spyOn(tx.workRequestDivisionCycle, 'findFirst').mockResolvedValue(cycle);
  jest.spyOn(tx.workRequestTeamStep, 'findFirst').mockResolvedValue({
    id: 'team-step-a',
    tenantId: 'tenant-a',
    routeId: 'route-a',
    divisionCycleId: 'cycle-a',
    ordinal: 1,
    teamId: 'team-a',
    definedAt: at,
    activatedAt: at,
    completedAt: null,
  });
  const profiles = jest
    .spyOn(tx.actorProfile, 'findMany')
    .mockResolvedValue([profile]);
  return {
    tx,
    profiles,
    locks,
    resolver: new ResponsibilityProfileResolver(uow),
  };
}

describe('ResponsibilityProfileResolver', () => {
  it('selects the only context-compatible profile and returns exact identity', async () => {
    const { tx, resolver, profiles, locks } = setup();
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        resolver.resolve(input, tx),
      ),
    ).resolves.toEqual({
      actorProfileId: 'actor-a',
      sourceUserId: 'user-a',
      sourceMemberId: 'member-a',
      sourceRoleId: 'role-a',
    });
    expect(profiles).toHaveBeenCalledTimes(1);
    expect(locks).toHaveBeenCalledTimes(6);
  });
  it.each([
    { candidates: [] },
    { candidates: [profile, { ...profile, id: 'actor-b' }] },
  ])('rejects zero or multiple candidate profiles', async ({ candidates }) => {
    const { tx, resolver, profiles } = setup();
    profiles.mockResolvedValue(candidates);
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        resolver.resolve(input, tx),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects tenant mismatch before accessing identity', async () => {
    const { tx, resolver } = setup();
    await expect(
      RequestContext.run({ tenantId: 'tenant-b' }, () =>
        resolver.resolve(input, tx),
      ),
    ).rejects.toThrow('active tenant transaction');
  });
  it('rejects a TeamStep outside the assigned execution context', async () => {
    const { tx, resolver } = setup();
    jest.spyOn(tx.workRequestTeamStep, 'findFirst').mockResolvedValue(null);
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        resolver.resolve(input, tx),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects a Division actor without a matching active DivisionLead', async () => {
    const { tx, resolver } = setup();
    jest.spyOn(tx.divisionLead, 'findFirst').mockResolvedValue(null);
    const division: ResponsibilityProfileContext = {
      tenantId: input.tenantId,
      workRequestId: input.workRequestId,
      routeId: input.routeId,
      divisionCycleId: input.divisionCycleId,
      memberId: input.memberId,
      responsibilityType: 'DIVISION',
      divisionLeadId: 'lead-a',
      requiredPermission: PermissionCode.ROUTE_FOR_REVIEW,
    };
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        resolver.resolve(division, tx),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
