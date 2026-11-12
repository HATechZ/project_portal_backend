import { WorkRequestV1AssignmentLevelCode as Level } from '../../generated/prisma/client';
import {
  canAccessWorkRequest,
  canViewWorkRequestMainWorkflow,
  relatedWorkRequestVisibilityWhere,
  workRequestVisibilityWhere,
} from './work-request-visibility';

describe('Work Request internal visibility', () => {
  const matching = <T extends object>(value: T): T =>
    expect.objectContaining(value) as T;
  const containing = <T>(value: T[]): T[] =>
    expect.arrayContaining(value) as T[];
  const anyArray = expect.any(Array) as unknown as unknown[];
  const actor = (
    scope: string | null,
    memberId = 'member-a',
    isActive = true,
    admin = false,
  ) =>
    ({
      role: {
        customScope: scope,
        systemRole:
          scope === 'company'
            ? null
            : { systemCode: admin ? 'tenant_super_admin' : 'other' },
      },
      member: {
        id: memberId,
        isActive,
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

  it.each([
    ['company', true],
    ['division', true],
    ['team', false],
    ['member', false],
  ])(
    'returns Main Workflow presentation visibility for %s scope',
    (scope, expected) => {
      expect(canViewWorkRequestMainWorkflow(actor(scope))).toBe(expected);
    },
  );

  it('returns Main Workflow presentation visibility for the same-tenant system administrator', () => {
    const admin = actor(null, 'member-a', true, true);

    expect(canViewWorkRequestMainWorkflow(admin)).toBe(true);
  });

  it('builds the lower-scope related-request predicate reused by parent reads', () => {
    expect(workRequestVisibilityWhere(actor('member'))).toEqual(
      matching({ OR: anyArray }),
    );
  });

  it('grants a responsible originating Lead route visibility only through an active Lead row', () => {
    expect(workRequestVisibilityWhere(actor('division'))).toEqual(
      matching({
        OR: containing([
          {
            route: {
              is: {
                responsibleOriginatingLead: {
                  is: matching({
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

  it('limits Division and Team access to active responsibility and preserves Member participation', () => {
    const division = workRequestVisibilityWhere(actor('division'));
    const team = workRequestVisibilityWhere(actor('team'));
    const member = workRequestVisibilityWhere(actor('member'));

    expect((division as { OR: unknown[] }).OR).toEqual(
      containing([
        {
          route: {
            is: {
              divisionCycles: {
                some: matching({
                  completedAt: null,
                  routeStep: {
                    is: matching({
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
      containing([
        {
          route: {
            is: {
              teamSteps: {
                some: matching({
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
      containing([
        {
          route: {
            is: {
              memberSteps: {
                some: matching({
                  memberId: 'member-a',
                  cancelledAt: null,
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
      matching({ OR: anyArray }),
    );
    const inactive = actor('division', 'member-a', false);
    expect(workRequestVisibilityWhere(inactive)).toEqual({ id: { in: [] } });
  });

  it('uses only the exact Member and non-cancelled step for participation across lifecycle changes', () => {
    const predicate = workRequestVisibilityWhere(actor('member', 'member-a'));
    expect(predicate.OR).toContainEqual({
      route: {
        is: {
          memberSteps: { some: { memberId: 'member-a', cancelledAt: null } },
        },
      },
    });
    const other = workRequestVisibilityWhere(actor('member', 'member-b'));
    expect(other.OR).not.toContainEqual({
      route: {
        is: {
          memberSteps: { some: { memberId: 'member-a', cancelledAt: null } },
        },
      },
    });
    expect(canViewWorkRequestMainWorkflow(actor('member', 'member-a'))).toBe(
      false,
    );
  });
});
