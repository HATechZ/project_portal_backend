import { WorkRequestInternalWorkflowProvider } from './work-request-internal-workflow.provider';

describe('WorkRequestInternalWorkflowProvider', () => {
  const provider = new WorkRequestInternalWorkflowProvider();
  const date = new Date('2026-11-11T00:00:00.000Z');

  function cycle(teamSteps: object[], completedAt: Date | null = null) {
    return {
      id: 'cycle-a',
      completedAt,
      routeStep: {
        divisionId: 'division-a',
        division: { id: 'division-a', name: 'Project Management' },
      },
      teamSteps,
    } as never;
  }

  it('derives automatic Division boundaries around the persisted ordered Team sequence', () => {
    const source = cycle([
      {
        id: 'step-c',
        ordinal: 3,
        activatedAt: null,
        completedAt: null,
        team: { id: 'team-c', name: 'Team C' },
      },
      {
        id: 'step-a',
        ordinal: 1,
        activatedAt: date,
        completedAt: null,
        team: { id: 'team-a', name: 'Team A' },
      },
      {
        id: 'step-b',
        ordinal: 2,
        activatedAt: null,
        completedAt: null,
        team: { id: 'team-b', name: 'Team B' },
      },
    ]);

    expect(provider.project(source)).toEqual(
      expect.objectContaining({
        currentTeamStepId: 'step-a',
        steps: [
          expect.objectContaining({
            kind: 'division-start',
            state: 'completed',
          }),
          expect.objectContaining({
            kind: 'team',
            teamName: 'Team A',
            ordinal: 1,
            state: 'current',
          }),
          expect.objectContaining({
            kind: 'team',
            teamName: 'Team B',
            ordinal: 2,
            state: 'upcoming',
          }),
          expect.objectContaining({
            kind: 'team',
            teamName: 'Team C',
            ordinal: 3,
            state: 'upcoming',
          }),
          expect.objectContaining({ kind: 'division-end', state: 'upcoming' }),
        ],
      }),
    );
  });

  it('supports a one-Team sequence and returns responsibility to Division after final Team completion', () => {
    const result = provider.project(
      cycle(
        [
          {
            id: 'step-a',
            ordinal: 1,
            activatedAt: date,
            completedAt: date,
            team: { id: 'team-a', name: 'Team A' },
          },
        ],
        date,
      ),
    );

    expect(result?.currentTeamStepId).toBeNull();
    expect(result?.steps).toEqual([
      expect.objectContaining({ kind: 'division-start', state: 'completed' }),
      expect.objectContaining({ kind: 'team', state: 'completed' }),
      expect.objectContaining({ kind: 'division-end', state: 'current' }),
    ]);
  });

  it('excludes retired or cancelled artifacts without changing the authoritative normal Team order', () => {
    const source = cycle([
      {
        id: 'step-a',
        ordinal: 1,
        activatedAt: date,
        completedAt: date,
        team: { id: 'team-a', name: 'Team A' },
      },
      {
        id: 'step-retired',
        ordinal: 2,
        activatedAt: null,
        completedAt: null,
        retiredAt: date,
        team: { id: 'team-retired', name: 'Retired' },
      },
      {
        id: 'step-b',
        ordinal: 3,
        activatedAt: date,
        completedAt: null,
        team: { id: 'team-b', name: 'Team B' },
      },
    ]);

    expect(
      provider
        .project(source)
        ?.steps.filter((step) => step.kind === 'team')
        .map((step) => step.teamName),
    ).toEqual(['Team A', 'Team B']);
    expect(source.teamSteps).toHaveLength(3);
  });

  it('returns null when a cycle has no Division context', () => {
    expect(
      provider.project({
        id: 'cycle-a',
        completedAt: null,
        routeStep: { divisionId: null, division: null },
        teamSteps: [],
      }),
    ).toBeNull();
  });
});
