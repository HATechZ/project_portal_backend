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
    to: State.MEMBER_SUBMITTED,
    event: 'WORK_SUBMITTED',
    responsibility: Level.MEMBER,
    label: 'Submit Work Request',
    targetKind: 'submit',
  },
  [WorkflowActionCode.WR_TEAM_LEAD_APPROVE]: {
    from: State.MEMBER_SUBMITTED,
    to: State.TEAM_LEAD_APPROVED,
    event: 'TEAM_LEAD_APPROVED',
    responsibility: Level.TEAM,
    label: 'Approve by Team Lead',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION]: {
    from: State.MEMBER_SUBMITTED,
    to: State.MEMBER_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.TEAM,
    label: 'Request Revision by Team Lead',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_DIVISION_LEAD_APPROVE]: {
    from: State.TEAM_LEAD_APPROVED,
    to: State.DIVISION_LEAD_APPROVED,
    event: 'DIVISION_LEAD_APPROVED',
    responsibility: Level.DIVISION,
    label: 'Approve by Division Lead',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION]: {
    from: State.TEAM_LEAD_APPROVED,
    to: State.TEAM_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.DIVISION,
    label: 'Request Revision by Division Lead',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_DIVISION_HEAD_APPROVE]: {
    from: State.DIVISION_LEAD_APPROVED,
    to: State.DIVISION_HEAD_APPROVED,
    event: 'DIVISION_HEAD_APPROVED',
    responsibility: Level.DIVISION,
    label: 'Approve by Division Head',
    targetKind: 'workflow',
  },
  [WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION]: {
    from: State.DIVISION_LEAD_APPROVED,
    to: State.DIVISION_ASSIGNED,
    event: 'REVISION_REQUESTED',
    responsibility: Level.DIVISION,
    label: 'Request Revision by Division Head',
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
): ReviewTransition | undefined {
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
  const rule = ASSIGNMENT_TRANSITIONS[level];
  if (state !== (replacing ? rule.assigned : rule.initial)) return undefined;
  return {
    priorState: state,
    resultingState: rule.assigned,
    action: replacing ? rule.reassign : rule.assign,
    replacing,
  };
}

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
