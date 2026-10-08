import { WorkRequestV1AssignmentLevelCode as Level } from '../../generated/prisma/client';
import { canAccessWorkRequest, workRequestVisibilityWhere } from './work-request-visibility';

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
    { level: Level.DIVISION, divisionId: 'division-a', teamId: null, memberId: null },
    {
      level: Level.TEAM,
      divisionId: null,
      teamId: 'team-a',
      memberId: null,
      team: { isActive: true, leadMemberId: 'member-a' },
    },
    { level: Level.MEMBER, divisionId: null, teamId: null, memberId: 'member-a' },
  ];

  it.each(['division', 'team', 'member'])(
    'does not make %s scope tenant-wide',
    (scope) => {
      expect(workRequestVisibilityWhere(actor(scope))).not.toEqual({});
      expect(canAccessWorkRequest(actor(scope), assignments)).toBe(true);
      expect(
        canAccessWorkRequest(actor(scope), [
          { level: Level.MEMBER, divisionId: null, teamId: null, memberId: 'other' },
        ]),
      ).toBe(false);
    },
  );

  it('allows company scope without inventing a lower-scope relationship', () => {
    expect(workRequestVisibilityWhere(actor('company'))).toEqual({});
    expect(canAccessWorkRequest(actor('company'), [])).toBe(true);
  });

  it('builds the lower-scope related-request predicate reused by parent reads', () => {
    expect(workRequestVisibilityWhere(actor('member'))).toEqual(
      expect.objectContaining({ assignments: expect.any(Object) }),
    );
  });

  it('builds the lower-scope related-request predicate reused by parent reads', () => {
    expect(workRequestVisibilityWhere(actor('member'))).toEqual(
      expect.objectContaining({ assignments: expect.any(Object) }),
    );
  });
});
