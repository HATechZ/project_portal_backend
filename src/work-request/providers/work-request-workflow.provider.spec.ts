import {
  ActorRoleCode,
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestWorkflowProvider } from './work-request-workflow.provider';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';

function errorStatus(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const status = (value as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

describe('WorkRequestWorkflowProvider', () => {
  const snapshot = (state: State, active: Record<string, string> = {}) => ({
    state,
    parent: { clientId: 'client-a', companyId: 'company-a' },
    active: {
      MEMBER: 'member-a',
      CHECKING: 'checking-a',
      APPROVAL: 'approval-a',
      FINAL_REVIEW: 'final-a',
      ...active,
    },
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
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(permission),
            },
          },
        ],
      },
      member: {
        id: memberId,
        companyId: 'company-a',
        isActive: true,
        company: { isActive: true },
        divisionLeadsByMemberId: [{ divisionId: 'division-a' }],
      },
    }) as never;
  const admin = (permission: WorkflowActionCode) =>
    ({
      id: 'admin-actor',
      clientContact: null,
      member: null,
      role: {
        customScope: null,
        systemRole: { systemCode: ActorRoleCode.tenant_super_admin },
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(permission),
            },
          },
        ],
      },
    }) as never;
  const subject = (
    state: State,
    action: WorkflowActionCode,
    active: Record<string, string> = {},
  ) => {
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot(state, active)),
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
      outbox,
    );
    return { provider, repository, outbox };
  };

  it.each([
    [
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
      State.CHECKING_REVIEW,
      'member-a',
      'MEMBER',
    ],
    [
      State.CHECKING_REVIEW,
      WorkflowActionCode.WR_CHECKING_APPROVE,
      State.APPROVAL_REVIEW,
      'checking-a',
      'CHECKING',
    ],
    [
      State.APPROVAL_REVIEW,
      WorkflowActionCode.WR_APPROVAL_APPROVE,
      State.FINAL_REVIEW,
      'approval-a',
      'APPROVAL',
    ],
    [
      State.FINAL_REVIEW,
      WorkflowActionCode.WR_FINAL_RELEASE,
      State.FINAL_RELEASE,
      'final-a',
      'FINAL_REVIEW',
    ],
    [
      State.CHECKING_REVIEW,
      WorkflowActionCode.WR_REQUEST_REVISION,
      State.MEMBER_ASSIGNED,
      'checking-a',
      'CHECKING',
    ],
    [
      State.APPROVAL_REVIEW,
      WorkflowActionCode.WR_REQUEST_REVISION,
      State.MEMBER_ASSIGNED,
      'approval-a',
      'APPROVAL',
    ],
    [
      State.FINAL_REVIEW,
      WorkflowActionCode.WR_REQUEST_REVISION,
      State.MEMBER_ASSIGNED,
      'final-a',
      'FINAL_REVIEW',
    ],
  ])(
    'appends the expected event-derived state for %s',
    async (state, action, expected, assignee, responsibility) => {
      const { provider, repository } = subject(state, action);
      if (action === WorkflowActionCode.WR_SUBMIT) {
        await RequestContext.run(
          { requestId: 'request-a', tenantId: 'tenant-a' },
          () => provider.submit('request-a', {}, actor(action, assignee)),
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
              actor(action, assignee),
            ),
        );
      }
      expect(repository.append).toHaveBeenCalledTimes(1);
      expect(repository.append).toHaveBeenCalledWith(
        expect.objectContaining({
          priorState: state,
          resultingState: expected,
          actorId: 'actor-a',
          responsibilityLevel: responsibility,
          note: action === WorkflowActionCode.WR_SUBMIT ? undefined : 'note',
          idempotencyKey: 'request-a',
        }),
      );
    },
  );

  it('rejects stale transitions without appending another event', async () => {
    const { provider, repository } = subject(
      State.CHECKING_REVIEW,
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

  it('allows tenant_super_admin to perform a valid internal transition without the current assignment', async () => {
    const { provider, repository } = subject(
      State.CHECKING_REVIEW,
      WorkflowActionCode.WR_CHECKING_APPROVE,
    );
    await RequestContext.run({ requestId: 'admin-request', tenantId: 'tenant-a' }, () =>
      provider.action(
        'request-a',
        'action-a',
        undefined,
        'administrative approval',
        admin(WorkflowActionCode.WR_CHECKING_APPROVE),
      ),
    );
    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-actor' }),
    );
  });

  it.each([
    [State.CHECKING_REVIEW, WorkflowActionCode.WR_CHECKING_APPROVE, 'member-a'],
    [
      State.APPROVAL_REVIEW,
      WorkflowActionCode.WR_APPROVAL_APPROVE,
      'checking-a',
    ],
    [State.FINAL_REVIEW, WorkflowActionCode.WR_FINAL_RELEASE, 'approval-a'],
  ])(
    'denies %s action to the wrong responsibility',
    async (state, action, memberId) => {
      const { provider, repository } = subject(state, action);
      await expect(
        RequestContext.run(
          { requestId: 'request-a', tenantId: 'tenant-a' },
          () =>
            provider.action(
              'request-a',
              'action-a',
              undefined,
              undefined,
              actor(action, memberId),
            ),
        ),
      ).rejects.toThrow();
      expect(repository.append).not.toHaveBeenCalled();
    },
  );

  it('denies an assignee without the action permission and an inactive/cross-company assignee', async () => {
    const { provider, repository } = subject(
      State.CHECKING_REVIEW,
      WorkflowActionCode.WR_CHECKING_APPROVE,
    );
    const noPermission = actor(WorkflowActionCode.WR_SUBMIT, 'checking-a');
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        provider.action(
          'request-a',
          'action-a',
          undefined,
          undefined,
          noPermission,
        ),
      ),
    ).rejects.toThrow();
    const inactive = actor(
      WorkflowActionCode.WR_CHECKING_APPROVE,
      'checking-a',
    );
    (inactive as any).member.isActive = false;
    await expect(
      RequestContext.run({ requestId: 'request-b', tenantId: 'tenant-a' }, () =>
        provider.action(
          'request-a',
          'action-a',
          undefined,
          undefined,
          inactive,
        ),
      ),
    ).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('denies stale/replaced reviewers, unrelated assignments, cross-company actors, and incompatible scope', async () => {
    const { provider, repository } = subject(
      State.CHECKING_REVIEW,
      WorkflowActionCode.WR_CHECKING_APPROVE,
      { CHECKING: 'replacement-a' },
    );
    const stale = actor(WorkflowActionCode.WR_CHECKING_APPROVE, 'checking-a');
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        provider.action('request-a', 'action-a', undefined, undefined, stale),
      ),
    ).rejects.toThrow();
    const crossCompany = actor(
      WorkflowActionCode.WR_CHECKING_APPROVE,
      'replacement-a',
    );
    (crossCompany as any).member.companyId = 'company-b';
    await expect(
      RequestContext.run({ requestId: 'request-b', tenantId: 'tenant-b' }, () =>
        provider.action(
          'request-a',
          'action-a',
          undefined,
          undefined,
          crossCompany,
        ),
      ),
    ).rejects.toThrow();
    const scoped = actor(
      WorkflowActionCode.WR_CHECKING_APPROVE,
      'replacement-a',
    );
    (scoped as any).role.customScope = 'division';
    (scoped as any).role.rolePermissions[0].permission.scopeCompatibilities =
      [];
    await expect(
      RequestContext.run({ requestId: 'request-c', tenantId: 'tenant-a' }, () =>
        provider.action('request-a', 'action-a', undefined, undefined, scoped),
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
        currentState = State.CHECKING_REVIEW;
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
      { enqueue: jest.fn() },
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
