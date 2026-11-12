import { WorkRequestInternalWorkflowProvider } from './work-request-internal-workflow.provider';

describe('internal workflow lifecycle states', () => {
  const provider = new WorkRequestInternalWorkflowProvider();
  const at = new Date('2026-01-01T00:00:00Z');
  const states = (cycle: any) =>
    provider.project(cycle)!.steps.map((step) => step.state);
  const team = (
    id: string,
    ordinal: number,
    activatedAt: Date | null,
    completedAt: Date | null,
  ) => ({ id, ordinal, activatedAt, completedAt, team: { id, name: id } });
  const base = () => ({
    id: 'cycle',
    completedAt: null as Date | null,
    routeStep: {
      kind: 'INTERMEDIATE',
      activatedAt: at as Date | null,
      completedAt: null as Date | null,
      divisionId: 'division',
      division: { id: 'division', name: 'Division' },
    },
    teamSteps: [] as ReturnType<typeof team>[],
  });

  it('follows both team steps from setup through Division forwarding', () => {
    const cycle = base();
    cycle.teamSteps = [team('a', 1, null, null), team('b', 2, null, null)];
    expect(states(cycle)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    cycle.teamSteps[0].activatedAt = at;
    expect(states(cycle)).toEqual([
      'completed',
      'current',
      'upcoming',
      'upcoming',
    ]);
    cycle.teamSteps[0].completedAt = at;
    cycle.teamSteps[1].activatedAt = at;
    expect(states(cycle)).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
    ]);
    cycle.teamSteps[1].completedAt = at;
    cycle.completedAt = at;
    expect(states(cycle)).toEqual([
      'completed',
      'completed',
      'completed',
      'current',
    ]);
    cycle.routeStep.completedAt = at;
    expect(states(cycle)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
    ]);
  });

  it('tracks the originating final review occurrence while another Division is active', () => {
    const cycle = {
      ...base(),
      route: {
        projection: {
          routeStepId: 'origin',
          routeVersion: {
            steps: [
              {
                id: 'final',
                divisionId: 'division',
                activatedAt: null as Date | null,
                completedAt: null as Date | null,
              },
            ],
          },
        },
      },
    };
    cycle.routeStep.kind = 'ORIGIN_START';
    const final = cycle.route.projection.routeVersion.steps[0];
    expect(states(cycle)).toEqual(['current', 'upcoming']);
    cycle.routeStep.completedAt = at;
    cycle.route.projection.routeStepId = 'pm';
    expect(states(cycle)).toEqual(['completed', 'upcoming']);
    final.activatedAt = at;
    cycle.route.projection.routeStepId = 'final';
    expect(states(cycle)).toEqual(['completed', 'current']);
    final.completedAt = at;
    cycle.route.projection.routeStepId = 'client';
    expect(states(cycle)).toEqual(['completed', 'completed']);
  });

  it('keeps an unstarted Division upcoming and a forwarded zero-team Division completed', () => {
    const cycle = base();
    cycle.routeStep.activatedAt = null;
    expect(states(cycle)).toEqual(['upcoming', 'upcoming']);
    cycle.routeStep.activatedAt = at;
    expect(states(cycle)).toEqual(['current', 'upcoming']);
    cycle.routeStep.completedAt = at;
    expect(states(cycle)).toEqual(['completed', 'completed']);
  });
});
