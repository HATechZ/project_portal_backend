import { PermissionCode } from '../../generated/prisma/client';
import { WorkRequestExecutionProvider } from './work-request-execution.provider';
import { WorkRequestExecutionController } from '../work-request-execution.controller';
import { WorkRequestInternalWorkflowProvider } from './work-request-internal-workflow.provider';

describe('WorkRequestExecutionProvider scope boundary', () => {
  const execution = {
    internalCycle: jest.fn(),
    internalCycles: jest.fn(),
    defineTeamSequence: jest.fn(),
    defineMemberSequence: jest.fn(),
    appendMemberStep: jest.fn(),
    submitMemberStep: jest.fn(),
    completeTeamStep: jest.fn(),
  };
  const reads = { find: jest.fn() };
  const provider = new WorkRequestExecutionProvider(
    execution as never,
    new WorkRequestInternalWorkflowProvider(),
    reads as never,
  );

  const actor = (scope: 'division' | 'team' | 'member') =>
    ({
      id: 'actor-a',
      member: { id: 'member-a', isActive: true },
      role: {
        customScope: scope,
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
              scopeCompatibilities: [{ scope }],
            },
          },
        ],
      },
    }) as never;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    undefined,
    { message: 'Completed' },
    { documentVersionIds: ['version-a'] },
    { message: 'Completed', documentVersionIds: ['version-a'] },
  ])(
    'passes the production controller payload and actor in repository order: %j',
    (input) => {
      const member = actor('member');
      new WorkRequestExecutionController(provider).submitMemberStep(
        'request-a',
        'step-a',
        input!,
        member,
      );
      expect(execution.submitMemberStep).toHaveBeenCalledWith(
        'request-a',
        'step-a',
        'actor-a',
        'member-a',
        input,
        false,
      );
    },
  );

  it('does not let a compatible permission bypass the Division execution scope', () => {
    expect(() =>
      provider.defineTeamSequence(
        'request-a',
        'cycle-a',
        { teamIds: ['team-a'] },
        actor('team'),
      ),
    ).toThrow("don't have permission");
    expect(execution.defineTeamSequence).not.toHaveBeenCalled();
  });

  it('does not let a Division-scoped profile define a Team member sequence', () => {
    expect(() =>
      provider.defineMemberSequence(
        'request-a',
        'team-step-a',
        { memberIds: ['member-a'] },
        actor('division'),
      ),
    ).toThrow("don't have permission");
    expect(execution.defineMemberSequence).not.toHaveBeenCalled();
  });

  it('does not let a Team-scoped profile submit a Member step', () => {
    expect(() =>
      provider.submitMemberStep(
        'request-a',
        'member-step-a',
        {},
        actor('team'),
      ),
    ).toThrow("don't have permission");
    expect(execution.submitMemberStep).not.toHaveBeenCalled();
  });

  it('projects the same originating lifecycle in collection and detail without exposing route context', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const cycle = {
      id: 'cycle-origin',
      completedAt: at,
      routeStep: {
        divisionId: 'division-a',
        division: { id: 'division-a', name: 'Marketing' },
        kind: 'ORIGIN_START',
        activatedAt: at,
        completedAt: at,
      },
      route: {
        projection: {
          routeStepId: 'pm',
          routeVersion: {
            steps: [
              {
                id: 'final',
                divisionId: 'division-a',
                activatedAt: null,
                completedAt: null,
              },
            ],
          },
        },
      },
      teamSteps: [],
      availableActions: [],
      workflowVisibility: {
        canViewMainWorkflow: true,
        canViewInternalWorkflow: true,
      },
    };
    reads.find.mockResolvedValue({ id: 'request-a' });
    execution.internalCycle.mockResolvedValue(cycle);
    execution.internalCycles.mockResolvedValue([cycle]);
    const detail = await provider.internalCycle(
      'request-a',
      cycle.id,
      actor('division'),
    );
    const collection = await provider.internalCycles(
      'request-a',
      actor('division'),
    );
    expect(detail.internalWorkflow?.steps.map((step) => step.state)).toEqual([
      'completed',
      'upcoming',
    ]);
    expect(collection.authorizedInternalWorkflows[0].internalWorkflow).toEqual(
      detail.internalWorkflow,
    );
    expect(detail).not.toHaveProperty('route');
    expect(detail.routeStep).toEqual({
      divisionId: 'division-a',
      division: cycle.routeStep.division,
    });
  });
  it('adds the Internal Workflow only to the already-authorized internal-cycle read', async () => {
    execution.internalCycle.mockResolvedValue({
      id: 'cycle-a',
      completedAt: null,
      routeStep: {
        divisionId: 'division-a',
        division: { id: 'division-a', name: 'Project Management' },
      },
      teamSteps: [
        {
          id: 'team-step-a',
          ordinal: 1,
          activatedAt: new Date(),
          completedAt: null,
          team: { id: 'team-a', name: 'Team A' },
        },
      ],
      availableActions: [],
      workflowVisibility: {
        canViewMainWorkflow: false,
        canViewInternalWorkflow: true,
      },
    });

    const result = await provider.internalCycle(
      'request-a',
      'cycle-a',
      actor('team'),
    );

    expect(result.internalWorkflow).toEqual(
      expect.objectContaining({
        divisionId: 'division-a',
        currentTeamStepId: 'team-step-a',
        steps: expect.arrayContaining([
          expect.objectContaining({ kind: 'division-start' }),
        ]),
      }),
    );
    expect(execution.internalCycle).toHaveBeenCalledWith(
      'request-a',
      'cycle-a',
      'member-a',
      false,
    );
    expect(result.workflowVisibility).toEqual({
      canViewMainWorkflow: false,
      canViewInternalWorkflow: true,
    });
  });

  it('projects pre-authorized completed and current Division cycles in repository order', async () => {
    const completedMarketing = {
      id: 'cycle-marketing',
      completedAt: new Date(),
      routeStep: {
        divisionId: 'division-marketing',
        division: { id: 'division-marketing', name: 'Marketing' },
      },
      teamSteps: [
        {
          id: 'team-step-marketing',
          ordinal: 1,
          activatedAt: new Date(),
          completedAt: new Date(),
          team: { id: 'team-marketing', name: 'Marketing Team' },
        },
      ],
    };
    const currentPm = {
      id: 'cycle-pm',
      completedAt: null,
      routeStep: {
        divisionId: 'division-pm',
        division: { id: 'division-pm', name: 'Project Management' },
      },
      teamSteps: [],
    };
    const admin = {
      id: 'admin-a',
      member: null,
      clientContact: null,
      role: {
        customScope: null,
        systemRole: { systemCode: 'tenant_super_admin' },
      },
    } as never;
    reads.find.mockResolvedValue({ id: 'request-a' });
    execution.internalCycles.mockResolvedValue([completedMarketing, currentPm]);

    const result = await provider.internalCycles('request-a', admin);

    expect(reads.find).toHaveBeenCalledWith('request-a', admin);
    expect(execution.internalCycles).toHaveBeenCalledWith(
      'request-a',
      null,
      true,
    );
    expect(result).toEqual({
      authorizedInternalWorkflows: [
        expect.objectContaining({
          divisionId: 'division-marketing',
          divisionCycleId: 'cycle-marketing',
          internalWorkflow: expect.objectContaining({
            divisionName: 'Marketing',
            steps: expect.arrayContaining([
              expect.objectContaining({
                kind: 'division-end',
                state: 'current',
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          divisionId: 'division-pm',
          divisionCycleId: 'cycle-pm',
        }),
      ],
    });
    expect(
      new Set(
        result.authorizedInternalWorkflows.map(
          ({ divisionCycleId }) => divisionCycleId,
        ),
      ).size,
    ).toBe(result.authorizedInternalWorkflows.length);
  });

  it('returns an empty authorized Internal Workflow collection without exposing another Division', async () => {
    reads.find.mockResolvedValue({ id: 'request-a' });
    execution.internalCycles.mockResolvedValue([]);

    await expect(
      provider.internalCycles('request-a', actor('division')),
    ).resolves.toEqual({ authorizedInternalWorkflows: [] });
  });

  it('does not discover cycles for an unrelated or cross-tenant Work Request read', async () => {
    reads.find.mockResolvedValue(null);

    await expect(
      provider.internalCycles('foreign-request', actor('division')),
    ).rejects.toMatchObject({ status: 404 });
    expect(execution.internalCycles).not.toHaveBeenCalled();
  });

  it.each([
    ['defineTeamSequence', 'division'],
    ['defineMemberSequence', 'team'],
    ['appendMemberStep', 'team'],
    ['submitMemberStep', 'member'],
    ['completeTeamStep', 'team'],
  ] as const)(
    'blocks archived Work Request %s mutations before execution',
    async (method, scope) => {
      const lifecycle = {
        assertActive: jest
          .fn()
          .mockRejectedValue(
            new Error('Work Request is archived and read-only.'),
          ),
      };
      const archivedProvider = new WorkRequestExecutionProvider(
        execution as never,
        new WorkRequestInternalWorkflowProvider(),
        reads as never,
        lifecycle as never,
      );
      const request = 'request-archived';
      const currentActor = actor(scope);
      const invoke = {
        defineTeamSequence: () =>
          archivedProvider.defineTeamSequence(
            request,
            'cycle-a',
            { teamIds: ['team-a'] },
            currentActor,
          ),
        defineMemberSequence: () =>
          archivedProvider.defineMemberSequence(
            request,
            'team-step-a',
            { memberIds: ['member-a'] },
            currentActor,
          ),
        appendMemberStep: () =>
          archivedProvider.appendMemberStep(
            request,
            'team-step-a',
            { memberId: 'member-a' },
            currentActor,
          ),
        submitMemberStep: () =>
          archivedProvider.submitMemberStep(
            request,
            'member-step-a',
            {},
            currentActor,
          ),
        completeTeamStep: () =>
          archivedProvider.completeTeamStep(
            request,
            'team-step-a',
            currentActor,
          ),
      }[method];

      await expect(invoke()).rejects.toThrow('archived and read-only');
      expect(lifecycle.assertActive).toHaveBeenCalledWith(request);
    },
  );
});
