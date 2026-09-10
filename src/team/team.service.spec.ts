import { ForbiddenException } from '@nestjs/common';
import {
  ActorScopeContext,
  ActorScopeKind,
} from '../common/security/object-scope.provider';
import { ActorRoleCode } from '../generated/prisma/client';
import { TeamScopeProvider } from './providers';
import { TeamMembershipService } from './team-membership.service';
import { TeamService } from './team.service';

const company = { id: 'company-1' };
const divisionA = 'division-a';
const divisionB = 'division-b';
const teamA = {
  id: 'team-a',
  companyId: company.id,
  divisionId: divisionA,
  name: 'Alpha',
  leadMemberId: 'lead-a',
  leadMember: { id: 'lead-a', name: 'Lead A', email: 'lead@example.com' },
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function actor(
  roleCode: ActorRoleCode,
  member?: { id: string; divisionId: string },
): ActorScopeContext {
  return {
    actorProfileId: 'actor-profile',
    roleId: 'role-id',
    roleCode,
    kind:
      roleCode === ActorRoleCode.system_admin
        ? ActorScopeKind.TenantAdmin
        : ActorScopeKind.Member,
    tenantWide: roleCode === ActorRoleCode.system_admin,
    member: member
      ? {
          id: member.id,
          companyId: company.id,
          divisionId: member.divisionId,
          active: true,
          companyActive: true,
          divisionActive: true,
        }
      : null,
    clientContact: null,
  };
}

function repository() {
  return {
    findScopedCompany: jest.fn().mockResolvedValue(company),
    findDivision: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(id === divisionA || id === divisionB ? { id } : null),
      ),
    findCompanyDivisionIds: jest.fn().mockResolvedValue([divisionA, divisionB]),
    findById: jest.fn().mockResolvedValue(teamA),
    findMember: jest.fn().mockResolvedValue({
      id: 'member-a',
      companyId: company.id,
      divisionId: divisionA,
      isActive: true,
    }),
    create: jest.fn().mockResolvedValue(teamA),
    updateName: jest.fn().mockResolvedValue(teamA),
    assignLead: jest
      .fn()
      .mockResolvedValue({ ...teamA, leadMemberId: 'member-a' }),
    hasAnyMembership: jest.fn().mockResolvedValue(false),
    delete: jest.fn().mockResolvedValue(undefined),
    listMembers: jest.fn().mockResolvedValue([]),
    findActiveMembership: jest.fn().mockResolvedValue(null),
    addMember: jest.fn().mockResolvedValue({
      id: 'tm-a',
      teamId: teamA.id,
      memberId: 'member-a',
      teamRole: null,
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      leftAt: null,
      member: { id: 'member-a', name: 'Member A', email: 'member@example.com' },
    }),
    endMember: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceWithRepository(repo = repository()) {
  const scope = new TeamScopeProvider(repo as never);
  const service = new TeamService(repo as never, scope);
  const membershipService = new TeamMembershipService(
    service,
    repo as never,
    scope,
  );
  return { service, membershipService, repo };
}

describe('TeamService scopes', () => {
  it('allows division_lead to create a Team only in their Division', async () => {
    const { service, repo } = serviceWithRepository();
    await expect(
      service.create(
        { divisionId: divisionA, name: 'New Team' },
        actor(ActorRoleCode.division_lead, {
          id: 'division-lead',
          divisionId: divisionA,
        }),
      ),
    ).resolves.toMatchObject({ id: teamA.id });
    expect(repo.create).toHaveBeenCalled();

    await expect(
      service.create(
        { divisionId: divisionB, name: 'Bad Team' },
        actor(ActorRoleCode.division_lead, {
          id: 'division-lead',
          divisionId: divisionA,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies contextual Team Lead Team creation', async () => {
    const { service } = serviceWithRepository();
    await expect(
      service.create(
        { divisionId: divisionA, name: 'Lead Created' },
        actor(ActorRoleCode.division_member, {
          id: 'lead-a',
          divisionId: divisionA,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns Team Lead for system_admin and same-Division division_lead', async () => {
    const { service } = serviceWithRepository();
    await expect(
      service.assignLead(
        teamA.id,
        { leadMemberId: 'member-a' },
        actor(ActorRoleCode.system_admin),
      ),
    ).resolves.toMatchObject({ leadMemberId: 'member-a' });

    await expect(
      service.assignLead(
        teamA.id,
        { leadMemberId: 'member-a' },
        actor(ActorRoleCode.division_lead, {
          id: 'division-lead',
          divisionId: divisionA,
        }),
      ),
    ).resolves.toMatchObject({ leadMemberId: 'member-a' });
  });

  it('denies other-Division lead assignment and cross-Division lead Member', async () => {
    const { service, repo } = serviceWithRepository();
    await expect(
      service.assignLead(
        teamA.id,
        { leadMemberId: 'member-a' },
        actor(ActorRoleCode.division_lead, {
          id: 'division-lead',
          divisionId: divisionB,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    repo.findMember.mockResolvedValueOnce({
      id: 'member-b',
      companyId: company.id,
      divisionId: divisionB,
      isActive: true,
    });
    await expect(
      service.assignLead(
        teamA.id,
        { leadMemberId: 'member-b' },
        actor(ActorRoleCode.system_admin),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows contextual Team Lead to add and remove only in the exact led Team', async () => {
    const { membershipService, repo } = serviceWithRepository();
    const lead = actor(ActorRoleCode.division_member, {
      id: 'lead-a',
      divisionId: divisionA,
    });
    await expect(
      membershipService.addMember(teamA.id, { memberId: 'member-a' }, lead),
    ).resolves.toMatchObject({ memberId: 'member-a' });
    await expect(
      membershipService.removeMember(teamA.id, 'member-a', lead),
    ).resolves.toBeUndefined();
    expect(repo.endMember).toHaveBeenCalledWith(teamA.id, 'member-a');

    repo.findById.mockResolvedValueOnce({
      ...teamA,
      id: 'team-b',
      leadMemberId: 'lead-b',
    });
    await expect(
      membershipService.addMember('team-b', { memberId: 'member-a' }, lead),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cross-Division Team membership assignment', async () => {
    const { membershipService, repo } = serviceWithRepository();
    repo.findMember.mockResolvedValueOnce({
      id: 'member-b',
      companyId: company.id,
      divisionId: divisionB,
      isActive: true,
    });
    await expect(
      membershipService.addMember(
        teamA.id,
        { memberId: 'member-b' },
        actor(ActorRoleCode.system_admin),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
