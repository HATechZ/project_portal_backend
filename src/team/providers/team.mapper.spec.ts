import { toTeamMemberResponse, toTeamResponse } from './team.mapper';

describe('Team response mapper', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');

  it('returns designation for both a Team lead and a Team member summary', () => {
    const lead = toTeamResponse({
      id: 'team-id',
      companyId: 'company-id',
      divisionId: 'division-id',
      name: 'Marketing',
      leadMemberId: 'lead-id',
      leadMember: {
        id: 'lead-id',
        name: 'Lead Member',
        email: 'lead@example.com',
        roleTitle: 'Team Lead',
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const member = toTeamMemberResponse({
      id: 'membership-id',
      teamId: 'team-id',
      memberId: 'member-id',
      teamRole: null,
      joinedAt: now,
      leftAt: null,
      member: {
        id: 'member-id',
        name: 'Team Member',
        email: 'member@example.com',
        roleTitle: 'Designer',
      },
    });

    expect(lead.leadMember).toMatchObject({ designation: 'Team Lead' });
    expect(member.member).toMatchObject({ designation: 'Designer' });
  });
});
