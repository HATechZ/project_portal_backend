import { Injectable } from '@nestjs/common';

type WorkflowState = 'completed' | 'current' | 'upcoming';

type TeamStep = {
  id: string;
  ordinal: number;
  activatedAt: Date | null;
  completedAt: Date | null;
  cancelledAt?: Date | null;
  retiredAt?: Date | null;
  team: { id: string; name: string };
};

type DivisionCycle = {
  id: string;
  completedAt: Date | null;
  routeStep: {
    divisionId: string | null;
    division: { id: string; name: string } | null;
  };
  teamSteps: TeamStep[];
};

export type InternalWorkflowProjection = {
  divisionId: string;
  divisionName: string;
  divisionCycleId: string;
  currentTeamStepId: string | null;
  steps: Array<
    | {
        kind: 'division-start';
        divisionId: string;
        divisionName: string;
        state: WorkflowState;
      }
    | {
        kind: 'team';
        teamStepId: string;
        teamId: string;
        teamName: string;
        ordinal: number;
        state: WorkflowState;
      }
    | {
        kind: 'division-end';
        divisionId: string;
        divisionName: string;
        state: WorkflowState;
      }
  >;
};

/** Pure read projection of the persisted Team sequence; it owns no execution state. */
@Injectable()
export class WorkRequestInternalWorkflowProvider {
  project(cycle: DivisionCycle): InternalWorkflowProjection | null {
    const division = cycle.routeStep.division;
    if (!cycle.routeStep.divisionId || !division) return null;

    const teamSteps = cycle.teamSteps
      .filter((step) => !step.cancelledAt && !step.retiredAt)
      .sort((left, right) => left.ordinal - right.ordinal);
    const current = teamSteps.find(
      (step) => !!step.activatedAt && !step.completedAt,
    );
    const startState: WorkflowState =
      current || teamSteps.length ? 'completed' : 'current';
    const endState: WorkflowState =
      cycle.completedAt && teamSteps.every((step) => !!step.completedAt)
        ? 'current'
        : 'upcoming';

    return {
      divisionId: division.id,
      divisionName: division.name,
      divisionCycleId: cycle.id,
      currentTeamStepId: current?.id ?? null,
      steps: [
        {
          kind: 'division-start',
          divisionId: division.id,
          divisionName: division.name,
          state: startState,
        },
        ...teamSteps.map((step) => ({
          kind: 'team' as const,
          teamStepId: step.id,
          teamId: step.team.id,
          teamName: step.team.name,
          ordinal: step.ordinal,
          state: teamState(step),
        })),
        {
          kind: 'division-end',
          divisionId: division.id,
          divisionName: division.name,
          state: endState,
        },
      ],
    };
  }
}

function teamState(step: TeamStep): WorkflowState {
  if (step.completedAt) return 'completed';
  if (step.activatedAt) return 'current';
  return 'upcoming';
}
