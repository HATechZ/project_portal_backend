import { WorkRequestV1AssignmentLevelCode as Level } from '../../generated/prisma/client';
import {
  canAccessWorkRequest,
  relatedWorkRequestVisibilityWhere,
  workRequestVisibilityWhere,
} from './work-request-visibility';

describe('Work Request internal visibility', () => {
  const actor = (scope: string | null, memberId = 'member-a') =>
    ({
      role: {
        customScope: scope,
        systemRole: scope === 'company' ? null : { systemCode: 'other' },
      },
      member: {
        id: memberId,
        isActive: true,
        company: { isActive: true },
        divisionLeadsByMemberId: [{ divisionId: 'division-a' }],
      },
    }) as never;

  const assignments = [
    {
      level: Level.DIVISION,
      divisionId: 'division-a',
      teamId: null,
      memberId: null,
    },
    {
      level: Level.TEAM,
      divisionId: null,
      teamId: 'team-a',
      memberId: null,
      team: { isActive: true, leadMemberId: 'member-a' },
    },
    {
      level: Level.MEMBER,
      divisionId: null,
      teamId: null,
      memberId: 'member-a',
    },
  ];

  it.each(['division', 'team', 'member'])(
    'does not make %s scope tenant-wide',
    (scope) => {
      expect(workRequestVisibilityWhere(actor(scope))).not.toEqual({});
      expect(canAccessWorkRequest(actor(scope), assignments)).toBe(true);
      expect(
        canAccessWorkRequest(actor(scope), [
          {
            level: Level.MEMBER,
            divisionId: null,
            teamId: null,
            memberId: 'other',
          },
        ]),
      ).toBe(false);
    },
  );

  it('allows company scope without inventing a lower-scope relationship', () => {
    expect(workRequestVisibilityWhere(actor('company'))).toEqual({});
    expect(relatedWorkRequestVisibilityWhere(actor('company'))).toBeUndefined();
    expect(canAccessWorkRequest(actor('company'), [])).toBe(true);
  });

  it('builds the lower-scope related-request predicate reused by parent reads', () => {
    expect(workRequestVisibilityWhere(actor('member'))).toEqual(
      expect.objectContaining({ OR: expect.any(Array) }),
    );
  });

  it('grants a responsible originating Lead route visibility only through an active Lead row', () => {
    expect(workRequestVisibilityWhere(actor('division'))).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          {
            route: {
              is: {
                responsibleOriginatingLead: {
                  is: expect.objectContaining({
                    memberId: 'member-a',
                    revokedAt: null,
                    member: { is: { isActive: true } },
                  }),
                },
              },
            },
          },
        ]),
      }),
    );
  });

  it('limits route visibility to an active Division cycle, Team step, or Member step', () => {
    const division = workRequestVisibilityWhere(actor('division'));
    const team = workRequestVisibilityWhere(actor('team'));
    const member = workRequestVisibilityWhere(actor('member'));

    expect((division as { OR: unknown[] }).OR).toEqual(
      expect.arrayContaining([
          {
            route: {
              is: {
                divisionCycles: {
                  some: expect.objectContaining({
                    completedAt: null,
                    routeStep: {
                      is: expect.objectContaining({
                        divisionId: { in: ['division-a'] },
                      }),
                    },
                  }),
                },
              },
            },
          },
      ]),
    );
    expect((team as { OR: unknown[] }).OR).toEqual(
      expect.arrayContaining([
          {
            route: {
              is: {
                teamSteps: {
                  some: expect.objectContaining({
                    activatedAt: { not: null },
                    completedAt: null,
                    team: { is: { isActive: true, leadMemberId: 'member-a' } },
                  }),
                },
              },
            },
          },
      ]),
    );
    expect((member as { OR: unknown[] }).OR).toEqual(
      expect.arrayContaining([
          {
            route: {
              is: {
                memberSteps: {
                  some: expect.objectContaining({
                    memberId: 'member-a',
                    activatedAt: { not: null },
                    submittedAt: null,
                  }),
                },
              },
            },
          },
      ]),
    );
  });

  it('does not expose route work to an unrelated or inactive lower-scope actor', () => {
    expect(workRequestVisibilityWhere(actor('member', 'unrelated'))).toEqual(
      expect.objectContaining({ OR: expect.any(Array) }),
    );
    const inactive = actor('division');
    inactive.member.isActive = false;
    expect(workRequestVisibilityWhere(inactive)).toEqual({ id: { in: [] } });
  });
});
