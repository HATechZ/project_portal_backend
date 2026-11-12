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
    kind?: string;
    activatedAt?: Date | null;
    completedAt?: Date | null;
  };
  route?: {
    projection: {
      routeStepId: string | null;
      routeVersion: {
        steps: Array<{
          id: string;
          divisionId: string | null;
          activatedAt: Date | null;
          completedAt: Date | null;
        }>;
      } | null;
    } | null;
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
    const routeStep = cycle.routeStep;
    const finalReview =
      routeStep.kind === 'ORIGIN_START'
        ? cycle.route?.projection?.routeVersion?.steps.find(
            (step) => step.divisionId === division.id,
          )
        : undefined;
    const startedTeams = teamSteps.some(
      (step) => step.activatedAt || step.completedAt,
    );
    const forwarded = !!routeStep.completedAt;
    const startState: WorkflowState =
      routeStep.kind === 'ORIGIN_FINAL_REVIEW' || forwarded || startedTeams
        ? 'completed'
        : routeStep.activatedAt === null
          ? 'upcoming'
          : 'current';
    let endState: WorkflowState = 'upcoming';
    if (finalReview) {
      if (finalReview.completedAt) endState = 'completed';
      else if (
        cycle.route?.projection?.routeStepId === finalReview.id &&
        finalReview.activatedAt
      )
        endState = 'current';
    } else if (forwarded) {
      endState = 'completed';
    } else if (
      routeStep.kind === 'ORIGIN_FINAL_REVIEW' &&
      routeStep.activatedAt
    ) {
      endState = 'current';
    } else if (
      teamSteps.length > 0 &&
      teamSteps.every((step) => !!step.completedAt)
    ) {
      endState = 'current';
    }

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
