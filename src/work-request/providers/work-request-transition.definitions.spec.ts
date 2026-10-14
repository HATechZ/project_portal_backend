import {
  WorkflowActionCode as Action,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import {
  assignmentTransitionFor,
  reviewTransitionFor,
} from './work-request-transition.definitions';

describe('generic Work Request review transitions', () => {
  it.each([
    [Action.WR_SUBMIT, State.MEMBER_ASSIGNED, State.CHECKING_REVIEW, Level.MEMBER],
    [Action.WR_CHECKING_APPROVE, State.CHECKING_REVIEW, State.APPROVAL_REVIEW, Level.CHECKING],
    [Action.WR_APPROVAL_APPROVE, State.APPROVAL_REVIEW, State.FINAL_REVIEW, Level.APPROVAL],
    [Action.WR_FINAL_RELEASE, State.FINAL_REVIEW, State.FINAL_RELEASE, Level.FINAL_REVIEW],
  ])('routes %s through its exact assigned responsibility', (action, from, to, responsibility) => {
    expect(reviewTransitionFor(action, from)).toMatchObject({ from, to, responsibility });
  });

  it.each([
    [State.CHECKING_REVIEW, Level.CHECKING],
    [State.APPROVAL_REVIEW, Level.APPROVAL],
    [State.FINAL_REVIEW, Level.FINAL_REVIEW],
  ])('returns %s revisions to preparation', (from, responsibility) => {
    expect(reviewTransitionFor(Action.WR_REQUEST_REVISION, from)).toMatchObject({
      from,
      to: State.MEMBER_ASSIGNED,
      responsibility,
    });
  });

  it('does not allow reviewer assignment from an invalid state', () => {
    expect(assignmentTransitionFor(Level.CHECKING, State.CREATED, false)).toBeUndefined();
  });
});
