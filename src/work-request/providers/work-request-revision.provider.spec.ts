import { CustomRoleScope, WorkRequestRouteRevisionClassification as Classification } from '../../generated/prisma/client';
import { WorkRequestRevisionProvider } from './work-request-revision.provider';

describe('WorkRequestRevisionProvider Phase 5 authorization', () => {
  const actor = (scope: CustomRoleScope | null) => ({
    id: 'actor-a',
    member: { id: 'member-a' },
    role: { customScope: scope },
  }) as never;

  it('rejects Member-scoped callers before a cross-Division formal request reaches persistence', async () => {
    const request = jest.fn();
    const provider = new WorkRequestRevisionProvider(
      { request } as never,
      { execute: (work: () => unknown) => work() } as never,
      { enqueue: jest.fn() } as never,
    );
    await expect(provider.request('request-a', {
      classification: Classification.CROSS_DIVISION_FORMAL,
      sourceActorId: 'actor-d',
      sourceDivisionCycleId: 'cycle-d',
      reason: 'Division correction.',
    }, actor(CustomRoleScope.member))).rejects.toMatchObject({ status: 403 });
    expect(request).not.toHaveBeenCalled();
  });
});
