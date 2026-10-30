import { ActorRoleCode, PermissionCode, WorkRequestRouteStepKind } from '../../generated/prisma/client';
import { WorkRequestRouteActionsProvider } from './work-request-route-actions.provider';

describe('WorkRequestRouteActionsProvider', () => {
  const actor = (
    permissions: PermissionCode[],
    memberId = 'lead-a',
    scope = 'division',
  ) => ({
    id: 'actor-a',
    member: { id: memberId, isActive: true, divisionLeadsByMemberId: [{ divisionId: 'division-a' }] },
    role: { customScope: scope, rolePermissions: permissions.map((code) => ({ revokedAt: null, permission: { code, scopeCompatibilities: [{ scope }] } })) },
  }) as never;
  const route = {
    responsibleOriginatingLead: {
      memberId: 'lead-a',
      revokedAt: null,
      member: { isActive: true },
      division: { isActive: true },
    },
    projection: { divisionCycleId: 'cycle-a', routeStepId: 'step-a', teamStepId: null, memberStepId: null },
    steps: [{ id: 'step-a', kind: WorkRequestRouteStepKind.ORIGIN_START }],
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

  it('does not give another Division Lead the origin-stage action', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(true), recipientActorIds: jest.fn().mockResolvedValue([]) } as never);
    await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM], 'lead-other'))).resolves.toEqual([]);
  });

  it.each([
    ['revoked', { ...route, responsibleOriginatingLead: { ...route.responsibleOriginatingLead, revokedAt: new Date() } }],
    ['inactive', { ...route, responsibleOriginatingLead: { ...route.responsibleOriginatingLead, member: { isActive: false } } }],
  ])('does not give a %s origin Lead an action', async (_, invalidRoute) => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(invalidRoute), isRelatedActor: jest.fn().mockResolvedValue(true), recipientActorIds: jest.fn().mockResolvedValue([]) } as never);
    await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM]))).resolves.toEqual([]);
  });

  it('requires the exact explicit permission even for the responsible origin Lead', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(true), recipientActorIds: jest.fn().mockResolvedValue([]) } as never);
    await expect(provider.available('request-a', actor([]))).resolves.toEqual([]);
  });

  it.each(['company', 'team', 'member'])(
    'does not expose Origin Lead actions through a %s-scoped profile before its stage',
    async (scope) => {
      const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(true), recipientActorIds: jest.fn().mockResolvedValue([]) } as never);
      await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM], 'lead-a', scope))).resolves.toEqual([]);
    },
  );

  it('does not expose Team or Member execution to a Division-scoped profile', async () => {
    const activeTeamRoute = {
      ...route,
      projection: {
        ...route.projection,
        teamStepId: 'team-step-a',
      },
      divisionCycles: [
        {
          ...route.divisionCycles[0],
          teamSteps: [
            {
              id: 'team-step-a',
              activatedAt: new Date(),
              completedAt: null,
              team: { leadMemberId: 'lead-a' },
              memberSteps: [],
            },
          ],
        },
      ],
    };
    const provider = new WorkRequestRouteActionsProvider({
      route: jest.fn().mockResolvedValue(activeTeamRoute),
      isRelatedActor: jest.fn().mockResolvedValue(true),
      recipientActorIds: jest.fn().mockResolvedValue([]),
    } as never);

    await expect(
      provider.available(
        'request-a',
        actor([PermissionCode.ASSIGN_WORK_REQUEST_MEMBER]),
      ),
    ).resolves.toEqual([]);
  });

  it('does not expose Origin Lead actions to an inactive ActorProfile Member', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn(), recipientActorIds: jest.fn() } as never);
    const inactive = actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM]);
    inactive.member.isActive = false;
    await expect(provider.available('request-a', inactive)).resolves.toEqual([]);
  });

  it('denies a cross-tenant/non-related actor before action resolution', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn().mockResolvedValue(false), recipientActorIds: jest.fn() } as never);
    await expect(provider.available('request-a', actor([PermissionCode.ASSIGN_WORK_REQUEST_TEAM], 'lead-a'))).resolves.toEqual([]);
  });

  it('exposes explicitly permitted internal route actions to tenant_super_admin without a Member', async () => {
    const provider = new WorkRequestRouteActionsProvider({ route: jest.fn().mockResolvedValue(route), isRelatedActor: jest.fn(), recipientActorIds: jest.fn() } as never);
    const admin = {
      id: 'admin-a',
      clientContact: null,
      member: null,
      role: {
        customScope: null,
        systemRole: { systemCode: ActorRoleCode.tenant_super_admin },
        rolePermissions: [{ revokedAt: null, permission: { code: PermissionCode.ASSIGN_WORK_REQUEST_TEAM } }],
      },
    } as never;
    await expect(provider.available('request-a', admin)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DEFINE_TEAM_SEQUENCE' })]),
    );
  });
});
