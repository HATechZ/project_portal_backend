import { TeamMembershipService } from './team-membership.service';
import { TeamService } from './team.service';

const company = { id: 'company-1' };
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

function repository() {
  return {
    findScopedCompany: jest.fn().mockResolvedValue(company),
    findCompanyDivisionIds: jest.fn().mockResolvedValue(['division-1']),
    findById: jest.fn().mockResolvedValue(team),
    findMember: jest.fn().mockResolvedValue({
      id: 'member-1',
      companyId: company.id,
      divisionId: 'division-1',
      isActive: true,
    }),
    create: jest.fn().mockResolvedValue(team),
    updateName: jest.fn().mockResolvedValue(team),
    assignLead: jest.fn().mockResolvedValue(team),
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
  it('enforces active same-company, same-division member eligibility as a business rule', async () => {
    const repo = repository();
    const service = new TeamService(repo as never);
    await expect(
      service.assignLead(team.id, { leadMemberId: 'member-1' }),
    ).resolves.toBeDefined();
    repo.findMember.mockResolvedValueOnce({
      id: 'member-2',
      companyId: company.id,
      divisionId: 'other',
      isActive: true,
    });
    await expect(
      service.assignLead(team.id, { leadMemberId: 'member-2' }),
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
});
