import { TeamMembershipService } from './team-membership.service';
import { TeamService } from './team.service';

const company = { id: 'company-1' };
const actor = {} as never;
const team = {
  id: 'team-1',
  companyId: company.id,
  divisionId: 'division-1',
  name: 'Alpha',
  leadMemberId: null,
  leadMember: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const teamWithLead = {
  ...team,
  leadMemberId: 'member-1',
  leadMember: {
    id: 'member-1',
    name: 'Lead Member',
    email: 'lead@example.test',
    designation: null,
  },
};

function repository() {
  return {
    findScopedCompany: jest.fn().mockResolvedValue(company),
    findCompanyDivisionIds: jest.fn().mockResolvedValue(['division-1']),
    findById: jest.fn().mockResolvedValue(team),
    findVisibleById: jest.fn().mockResolvedValue(team),
    findMember: jest.fn().mockResolvedValue({
      id: 'member-1',
      companyId: company.id,
      divisionId: 'division-1',
      isActive: true,
    }),
    create: jest.fn().mockResolvedValue(team),
    updateName: jest.fn().mockResolvedValue(team),
    assignLead: jest.fn().mockResolvedValue(team),
    clearLead: jest.fn().mockResolvedValue(team),
    hasAnyMembership: jest.fn().mockResolvedValue(false),
    delete: jest.fn(),
    listMembers: jest.fn().mockResolvedValue([]),
    findActiveMembership: jest.fn().mockResolvedValue(null),
    addMember: jest.fn().mockResolvedValue({
      id: 'membership-1',
      teamId: team.id,
      memberId: 'member-1',
      teamRole: null,
      joinedAt: new Date(),
      leftAt: null,
      member: {
        id: 'member-1',
        name: 'Member',
        email: 'member@example.test',
      },
    }),
    endMember: jest.fn(),
  };
}

describe('Team services', () => {
  it('clears only the Team Lead assignment and returns the cleared relation', async () => {
    const repo = repository();
    repo.findById.mockResolvedValue(teamWithLead);
    repo.clearLead.mockResolvedValue(team);
    const service = new TeamService(repo as never);

    await expect(service.clearLead(team.id, actor)).resolves.toMatchObject({
      id: team.id,
      leadMemberId: null,
      leadMember: null,
    });
    expect(repo.clearLead).toHaveBeenCalledWith(team.id, company.id);
    expect(repo.findMember).not.toHaveBeenCalled();
    expect(repo.endMember).not.toHaveBeenCalled();
  });

  it('is idempotent when the Team already has no lead and permits reassignment', async () => {
    const repo = repository();
    const reassigned = { ...teamWithLead, leadMemberId: 'member-2' };
    repo.clearLead.mockResolvedValue(team);
    repo.assignLead.mockResolvedValue(reassigned);
    const service = new TeamService(repo as never);

    await expect(service.clearLead(team.id, actor)).resolves.toMatchObject({
      leadMemberId: null,
      leadMember: null,
    });
    await expect(
      service.assignLead(team.id, { leadMemberId: 'member-2' }, actor),
    ).resolves.toMatchObject({ leadMemberId: 'member-2' });
    expect(repo.clearLead).toHaveBeenCalledTimes(1);
    expect(repo.assignLead).toHaveBeenCalledWith(
      team.id,
      company.id,
      'member-2',
    );
  });

  it('requires the same scoped Team visibility used by lead assignment', async () => {
    const repo = repository();
    repo.findVisibleById.mockResolvedValue(null);
    const service = new TeamService(repo as never);

    await expect(service.clearLead(team.id, actor)).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.findVisibleById).toHaveBeenCalledWith(
      team.id,
      company.id,
      actor,
    );
    expect(repo.clearLead).not.toHaveBeenCalled();
  });

  it('enforces active same-company, same-division member eligibility as a business rule', async () => {
    const repo = repository();
    const service = new TeamService(repo as never);
    await expect(
      service.assignLead(team.id, { leadMemberId: 'member-1' }, actor),
    ).resolves.toBeDefined();
    repo.findMember.mockResolvedValueOnce({
      id: 'member-2',
      companyId: company.id,
      divisionId: 'other',
      isActive: true,
    });
    await expect(
      service.assignLead(team.id, { leadMemberId: 'member-2' }, actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('preserves TeamMembership lifecycle rules without role-derived access', async () => {
    const repo = repository();
    const teams = new TeamService(repo as never);
    const membership = new TeamMembershipService(teams, repo as never);
    await membership.addMember(team.id, { memberId: 'member-1' });
    expect(repo.addMember).toHaveBeenCalledWith(team.id, 'member-1', undefined);
    repo.findActiveMembership.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      membership.addMember(team.id, { memberId: 'member-1' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects a cross-Division Team member submitted directly', async () => {
    const repo = repository();
    repo.findMember.mockResolvedValueOnce({
      id: 'member-b',
      companyId: company.id,
      divisionId: 'division-b',
      isActive: true,
    });
    const service = new TeamMembershipService(
      new TeamService(repo as never),
      repo as never,
    );
    await expect(
      service.addMember(team.id, { memberId: 'member-b' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('does not exclude a valid candidate due to another Team in the same Division', async () => {
    const repo = repository();
    const service = new TeamMembershipService(
      new TeamService(repo as never),
      repo as never,
    );
    await service.addMember(team.id, { memberId: 'member-1' });
    expect(repo.findActiveMembership).toHaveBeenCalledWith(team.id, 'member-1');
    expect(repo.addMember).toHaveBeenCalledWith(team.id, 'member-1', undefined);
  });
});
