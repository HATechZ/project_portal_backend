import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestWorkflowProvider } from './work-request-workflow.provider';

function errorStatus(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const status = (value as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

describe('WorkRequestWorkflowProvider', () => {
  const snapshot = (state: State) => ({
    state,
    parent: { clientId: 'client-a', companyId: 'company-a' },
    active: { DIVISION: 'division-a', TEAM: 'team-a', MEMBER: 'member-a' },
    teamLeadMemberId: 'team-lead-a',
  });
  const actor = (permission: WorkflowActionCode, memberId = 'member-a') =>
    ({
      id: 'actor-a',
      boundTeamId: null,
      role: {
        isSystemRole: true,
        customScope: null,
        userRolesByRoleId: [{ teamId: null }],
        workflowActionRolePermissionsByRoleId: [
          { action: { code: permission } },
        ],
      },
      member: {
        id: memberId,
        companyId: 'company-a',
        isActive: true,
        company: { isActive: true },
      },
    }) as never;
  const subject = (state: State, action: WorkflowActionCode) => {
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot(state)),
      actionCode: jest.fn().mockResolvedValue({ code: action }),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      append: jest.fn().mockResolvedValue({
        eventId: 'event-a',
        action: 'WORK_SUBMITTED',
        currentState: state,
        occurredAt: new Date(),
      }),
    };
    const outbox = { enqueue: jest.fn() };
    const provider = new WorkRequestWorkflowProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      {
        resolve: jest
          .fn()
          .mockReturnValue({ isSystemRole: true, customScope: null }),
        assertCanAccess: jest.fn(),
      } as never,
      outbox as never,
    );
    return { provider, repository, outbox };
  };

  it.each([
    [
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
      State.MEMBER_SUBMITTED,
    ],
    [
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_TEAM_LEAD_APPROVE,
      State.TEAM_LEAD_APPROVED,
    ],
    [
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION,
      State.MEMBER_ASSIGNED,
    ],
    [
      State.TEAM_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_LEAD_APPROVE,
      State.DIVISION_LEAD_APPROVED,
    ],
    [
      State.TEAM_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION,
      State.TEAM_ASSIGNED,
    ],
    [
      State.DIVISION_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_HEAD_APPROVE,
      State.DIVISION_HEAD_APPROVED,
    ],
    [
      State.DIVISION_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION,
      State.DIVISION_ASSIGNED,
    ],
  ])(
    'appends the expected event-derived state for %s',
    async (state, action, expected) => {
      const { provider, repository } = subject(state, action);
      const reviewer =
        action === WorkflowActionCode.WR_TEAM_LEAD_APPROVE ||
        action === WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION
          ? 'team-lead-a'
          : 'member-a';
      if (action === WorkflowActionCode.WR_SUBMIT) {
        await RequestContext.run(
          { requestId: 'request-a', tenantId: 'tenant-a' },
          () => provider.submit('request-a', {}, actor(action)),
        );
      } else {
        await RequestContext.run(
          { requestId: 'request-a', tenantId: 'tenant-a' },
          () =>
            provider.action(
              'request-a',
              'action-a',
              undefined,
              'note',
              actor(action, reviewer),
            ),
        );
      }
      expect(repository.append).toHaveBeenCalledTimes(1);
      expect(repository.append).toHaveBeenCalledWith(
        expect.objectContaining({ resultingState: expected }),
      );
    },
  );

  it('rejects stale transitions without appending another event', async () => {
    const { provider, repository } = subject(
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_SUBMIT,
    );
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        provider.submit('request-a', {}, actor(WorkflowActionCode.WR_SUBMIT)),
      ),
    ).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('rejects a Member who is not the active Member assignment', async () => {
    const { provider, repository } = subject(
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
    );
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        provider.submit(
          'request-a',
          {},
          actor(WorkflowActionCode.WR_SUBMIT, 'member-b'),
        ),
      ),
    ).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('rejects a repeated workflow idempotency key before appending another event', async () => {
    const { provider, repository } = subject(
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
    );
    repository.findByIdempotencyKey = jest
      .fn()
      .mockResolvedValue({ id: 'event-a' });
    await expect(
      RequestContext.run({ requestId: 'retry-key', tenantId: 'tenant-a' }, () =>
        provider.submit('request-a', {}, actor(WorkflowActionCode.WR_SUBMIT)),
      ),
    ).rejects.toThrow('already been applied');
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('enqueues the transition fact only after the workflow event is appended', async () => {
    const { provider, outbox } = subject(
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
    );
    await RequestContext.run(
      {
        requestId: '00000000-0000-4000-8000-000000000001',
        tenantId: 'tenant-a',
      },
      () =>
        provider.submit('request-a', {}, actor(WorkflowActionCode.WR_SUBMIT)),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue an outbox fact when the workflow event append fails', async () => {
    const { provider, repository, outbox } = subject(
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
    );
    repository.append.mockRejectedValue(new Error('rollback'));
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        provider.submit('request-a', {}, actor(WorkflowActionCode.WR_SUBMIT)),
      ),
    ).rejects.toThrow('rollback');
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('allows one of two concurrent conflicting submissions and rejects the stale one', async () => {
    let currentState = State.MEMBER_ASSIGNED;
    let tail = Promise.resolve();
    const uow = {
      execute: <T>(work: () => Promise<T>) => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        return previous.then(async () => {
          try {
            return await work();
          } finally {
            release();
          }
        });
      },
    };
    const repository = {
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      prepare: jest
        .fn()
        .mockImplementation(() => Promise.resolve(snapshot(currentState))),
      append: jest.fn().mockImplementation(() => {
        currentState = State.MEMBER_SUBMITTED;
        return Promise.resolve({
          eventId: 'event-a',
          action: 'WORK_SUBMITTED',
          currentState,
          occurredAt: new Date(),
        });
      }),
    };
    const provider = new WorkRequestWorkflowProvider(
      repository as never,
      uow as never,
      {
        resolve: jest
          .fn()
          .mockReturnValue({ isSystemRole: true, customScope: null }),
        assertCanAccess: jest.fn(),
      } as never,
      { enqueue: jest.fn() } as never,
    );
    const actorForSubmit = actor(WorkflowActionCode.WR_SUBMIT);
    const outcomes = await Promise.allSettled([
      RequestContext.run(
        { requestId: 'request-one', tenantId: 'tenant-a' },
        () => provider.submit('request-a', {}, actorForSubmit),
      ),
      RequestContext.run(
        { requestId: 'request-two', tenantId: 'tenant-a' },
        () => provider.submit('request-a', {}, actorForSubmit),
      ),
    ]);

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    const rejected = outcomes.find(({ status }) => status === 'rejected');
    expect(
      rejected?.status === 'rejected'
        ? errorStatus(rejected.reason)
        : undefined,
    ).toBe(409);
    expect(repository.append).toHaveBeenCalledTimes(1);
  });
});
