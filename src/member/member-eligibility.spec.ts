import { validate } from 'class-validator';
import { RequestContext } from '../common/context/request-context';
import type { SessionActor } from '../common/security/session.types';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { MemberEligibilityController } from './member-eligibility.controller';
import { MemberEligibilityService } from './member-eligibility.service';
import { MemberEligibilityQueryDto } from './dtos/member-eligibility-query.dto';
import { MemberEligibilityRepository } from './repositories/member-eligibility.repository';
import { eligibleMemberSelect } from './repositories/member-eligibility.records';

const tenantId = 'tenant-a';
const companyId = 'company-a';
const divisionId = 'division-a';
const actor = (scope = 'company', member: unknown = null) =>
  ({
    role: { customScope: scope, isSystemRole: false },
    member,
  }) as unknown as SessionActor;
const memberContext = {
  id: 'member-a',
  companyId,
  isActive: true,
  company: { isActive: true },
  divisionLeadsByMemberId: [{ divisionId }],
};

function subject() {
  const base = {
    companyId,
    tenantId,
    divisionId,
    isActive: true,
    name: 'Candidate',
    email: 'candidate@example.test',
    teamMembersByMemberId: [],
    teamsByLeadMemberId: [],
  };
  const members = [
    { ...base, id: 'member-free' },
    {
      ...base,
      id: 'member-a',
      teamMembersByMemberId: [
        {
          teamRole: 'Coordinator',
          team: {
            id: 'other-team',
            name: 'Other Team',
            leadMemberId: 'member-a',
          },
        },
      ],
      teamsByLeadMemberId: [
        { id: 'other-team', name: 'Other Team' },
        { id: 'lead-only', name: 'Lead Only' },
      ],
    },
    { ...base, id: 'member-b', divisionId: 'division-b' },
    { ...base, id: 'member-foreign', tenantId: 'tenant-b' },
    { ...base, id: 'member-inactive', isActive: false },
  ];
  const db = {
    division: {
      findFirst: jest.fn().mockResolvedValue({ id: divisionId, companyId }),
    },
    team: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ divisionId, companyId, leadMemberId: 'member-a' }),
    },
    member: {
      findMany: jest.fn(
        (query: {
          where: {
            tenantId: string;
            companyId: string;
            divisionId: string;
            isActive: boolean;
          };
        }) =>
          Promise.resolve(
            members.filter(
              (candidate) =>
                candidate.tenantId === query.where.tenantId &&
                candidate.companyId === query.where.companyId &&
                candidate.divisionId === query.where.divisionId &&
                candidate.isActive === query.where.isActive,
            ),
          ),
      ),
    },
  };
  const repository = new MemberEligibilityRepository({
    execute: (work: (executor: unknown) => Promise<unknown>) => work(db),
  } as never);
  const service = new MemberEligibilityService(repository);
  const find = (query: MemberEligibilityQueryDto, caller = actor()) =>
    RequestContext.run({ tenantId, requestId: 'eligibility-test' }, () =>
      service.findEligible(query, caller),
    );
  return { db, find };
}

describe('assignment member eligibility', () => {
  it.each([{ divisionId }, { teamId: 'team-a' }])(
    'returns only active same-Tenant Members of the target Division: %j',
    async (query) => {
      const { find, db } = subject();
      const result = await find(query);
      expect(result.map(({ memberId }) => memberId)).toEqual([
        'member-free',
        'member-a',
      ]);
      expect(db.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, companyId, divisionId, isActive: true },
        }),
      );
    },
  );

  it('resolves the exact Team Division server-side and does not use an arbitrary led Team', async () => {
    const { find, db } = subject();
    await find({ teamId: 'team-a' });
    expect(db.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'team-a',
          tenantId,
          isActive: true,
          division: { isActive: true },
          company: { isActive: true },
        },
      }),
    );
    expect(db.division.findFirst).not.toHaveBeenCalled();
  });

  it('includes existing Team members with membership and independent lead metadata', async () => {
    const { find } = subject();
    const result = await find({ teamId: 'team-a' });
    expect(result.find(({ memberId }) => memberId === 'member-a')).toEqual({
      memberId: 'member-a',
      name: 'Candidate',
      email: 'candidate@example.test',
      isTeamLead: true,
      activeTeamMemberships: [
        {
          teamId: 'other-team',
          name: 'Other Team',
          teamRole: 'Coordinator',
          isTeamLead: true,
        },
      ],
      ledTeams: [
        { teamId: 'other-team', name: 'Other Team' },
        { teamId: 'lead-only', name: 'Lead Only' },
      ],
    });
  });

  it('limits metadata to unended membership on active same-Tenant, same-Division Teams', () => {
    const select = eligibleMemberSelect(tenantId, companyId, divisionId);
    expect(select.teamMembersByMemberId.where).toEqual({
      tenantId,
      leftAt: null,
      team: { tenantId, companyId, divisionId, isActive: true },
    });
    expect(select.teamsByLeadMemberId.where).toEqual({
      tenantId,
      companyId,
      divisionId,
      isActive: true,
    });
  });

  it('returns 404 for missing/foreign targets without querying candidates', async () => {
    const { find, db } = subject();
    db.team.findFirst.mockResolvedValueOnce(null);
    await expect(find({ teamId: 'foreign-team' })).rejects.toMatchObject({
      status: 404,
    });
    expect(db.member.findMany).not.toHaveBeenCalled();
    expect(db.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }) as unknown,
      }),
    );
  });

  it('allows led-Division and exact-led-Team scope but rejects unrelated resource scope', async () => {
    const { find } = subject();
    await expect(
      find({ divisionId }, actor('division', memberContext)),
    ).resolves.toHaveLength(2);
    await expect(
      find({ teamId: 'team-a' }, actor('team', memberContext)),
    ).resolves.toHaveLength(2);
    await expect(
      find({ divisionId }, actor('team', memberContext)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      find(
        { divisionId },
        actor('division', {
          ...memberContext,
          divisionLeadsByMemberId: [{ divisionId: 'division-b' }],
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      find({ teamId: 'team-a' }, actor('member', memberContext)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('requires exactly one target and retains explicit permission authorization', async () => {
    const { find, db } = subject();
    await expect(find({})).rejects.toMatchObject({ status: 400 });
    await expect(find({ divisionId, teamId: 'team-a' })).rejects.toMatchObject({
      status: 400,
    });
    expect(db.member.findMany).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata(
        FINAL_PERMISSIONS_KEY,
        Object.getOwnPropertyDescriptor(
          MemberEligibilityController.prototype,
          'findEligible',
        )!.value as object,
      ) as unknown,
    ).toEqual(['VIEW_MEMBERS']);
    expect(await validate(new MemberEligibilityQueryDto())).not.toEqual([]);
    expect(
      await validate(
        Object.assign(new MemberEligibilityQueryDto(), {
          divisionId: 'not-a-uuid',
        }),
      ),
    ).not.toEqual([]);
  });
});
