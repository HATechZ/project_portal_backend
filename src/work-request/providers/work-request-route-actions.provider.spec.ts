import { PermissionCode } from '../../generated/prisma/client';
import { WorkRequestRouteActionsProvider } from './work-request-route-actions.provider';

describe('WorkRequestRouteActionsProvider', () => {
  const actor = (permissions: PermissionCode[]) => ({
    id: 'actor-a',
    member: { id: 'lead-a', isActive: true, divisionLeadsByMemberId: [{ divisionId: 'division-a' }] },
    role: { customScope: 'division', rolePermissions: permissions.map((code) => ({ revokedAt: null, permission: { code, scopeCompatibilities: [{ scope: 'division' }] } })) },
  }) as never;
  const route = {
    responsibleOriginatingLead: { memberId: 'lead-a' },
    projection: { divisionCycleId: 'cycle-a', routeStepId: 'step-a', teamStepId: null, memberStepId: null },
    steps: [{ id: 'step-a', kind: 'INTERMEDIATE' }],
    divisionCycles: [{ id: 'cycle-a', completedAt: null, routeStep: { divisionId: 'division-a' }, teamSteps: [] }],
  };

  it('derives lifecycle actions from exact active route responsibility, not a role label', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(true), recipientActorIds: jest.fn().mockResolvedValue([]) } as never);
    await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM]))).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DEFINE_TEAM_SEQUENCE' })]));
  });

  it('returns no route action for an unrelated same-tenant actor', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(false), recipientActorIds: jest.fn() } as never);
    await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM]))).resolves.toEqual([]);
  });
});
