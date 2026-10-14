import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';

export type ReviewTransition = {
  from: State;
  to: State;
  event: string;
  responsibility: Level;
  label: string;
  targetKind: 'submit' | 'workflow';
};

export const WORK_REQUEST_REVIEW_TRANSITIONS = {
  [WorkflowActionCode.WR_SUBMIT]: {
    from: State.MEMBER_ASSIGNED,
    to: State.CHECKING_REVIEW,
    event: 'WORK_SUBMITTED',
    responsibility: Level.MEMBER,
    label: 'Submit Work Request',
    targetKind: 'submit',
  },
  [WorkflowActionCode.WR_CHECKING_APPROVE]: {
    from: State.CHECKING_REVIEW,
    to: State.APPROVAL_REVIEW,
    event: 'CHECKING_APPROVED',
    responsibility: Level.CHECKING,
    label: 'Approve checking review',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_APPROVAL_APPROVE]: {
    from: State.APPROVAL_REVIEW,
    to: State.FINAL_REVIEW,
    event: 'APPROVAL_APPROVED',
    responsibility: Level.APPROVAL,
    label: 'Approve approval review',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_REQUEST_REVISION]: {
    from: State.CHECKING_REVIEW,
    to: State.MEMBER_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.CHECKING,
    label: 'Request revision',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_FINAL_RELEASE]: {
    from: State.FINAL_REVIEW,
    to: State.FINAL_RELEASE,
    event: 'FINAL_RELEASED',
    responsibility: Level.FINAL_REVIEW,
    label: 'Release final package',
    targetKind: 'workflow',
  },
} as const satisfies Partial<Record<WorkflowActionCode, ReviewTransition>>;

const ASSIGNMENT_TRANSITIONS = {
  [Level.DIVISION]: {
    initial: State.CREATED,
    assigned: State.DIVISION_ASSIGNED,
    assign: 'DIVISION_ASSIGNED',
    reassign: 'DIVISION_REASSIGNED',
  },
  [Level.TEAM]: {
    initial: State.DIVISION_ASSIGNED,
    assigned: State.TEAM_ASSIGNED,
    assign: 'TEAM_ASSIGNED',
    reassign: 'TEAM_REASSIGNED',
  },
  [Level.MEMBER]: {
    initial: State.TEAM_ASSIGNED,
    assigned: State.MEMBER_ASSIGNED,
    assign: 'MEMBER_ASSIGNED',
    reassign: 'MEMBER_REASSIGNED',
  },
} as const;

export function reviewTransitionFor(
  action: WorkflowActionCode,
  state?: State | null,
): ReviewTransition | undefined {
  if (action === WorkflowActionCode.WR_REQUEST_REVISION && state) {
    const responsibility = {
      [State.CHECKING_REVIEW]: Level.CHECKING,
      [State.APPROVAL_REVIEW]: Level.APPROVAL,
      [State.FINAL_REVIEW]: Level.FINAL_REVIEW,
    }[state];
    return responsibility
      ? {
          from: state,
          to: State.MEMBER_ASSIGNED,
          event: 'REVISION_REQUESTED',
          responsibility,
          label: 'Request revision',
          targetKind: 'workflow',
        }
      : undefined;
  }
  return (
    WORK_REQUEST_REVIEW_TRANSITIONS as Partial<
      Record<WorkflowActionCode, ReviewTransition>
    >
  )[action];
}

export function assignmentTransitionFor(
  level: Level,
  state: State | null,
  replacing: boolean,
) {
  if (
    level === Level.CHECKING ||
    level === Level.APPROVAL ||
    level === Level.FINAL_REVIEW
  ) {
    if (
      !state ||
      !REVIEWER_ASSIGNMENT_STATES.includes(state as never)
    )
      return undefined;
    return {
      priorState: state,
      resultingState: state,
      action: `${level}_${replacing ? 'REASSIGNED' : 'ASSIGNED'}`,
      replacing,
    };
  }
  const rule = ASSIGNMENT_TRANSITIONS[level];
  if (state !== (replacing ? rule.assigned : rule.initial)) return undefined;
  return {
    priorState: state,
    resultingState: rule.assigned,
    action: replacing ? rule.reassign : rule.assign,
    replacing,
  };
}

const REVIEWER_ASSIGNMENT_STATES = [
  State.MEMBER_ASSIGNED,
  State.CHECKING_REVIEW,
  State.APPROVAL_REVIEW,
  State.FINAL_REVIEW,
] as const;

export function workRequestTransitionRequestMetadata() {
  const requestId = RequestContext.requestId();
  return {
    idempotencyKey: requestId,
    correlationId:
      requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
        ? requestId
        : undefined,
  };
}
