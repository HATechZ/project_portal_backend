import { RequestContext } from '../../common/context/request-context';
import { WorkRequestExecutionRepository } from './work-request-execution.repository';

describe('WorkRequestExecutionRepository Phase 4 execution guards', () => {
  const context = <T>(work: () => Promise<T>) =>
    RequestContext.run({ requestId: 'execution-test', tenantId: 'tenant-a' }, work);

  function repository(db: Record<string, unknown>) {
    return new WorkRequestExecutionRepository({
      execute: (work: (executor: never) => Promise<unknown>) => work(db as never),
    } as never);
  }

  it('freezes a Team sequence once its first execution step exists', async () => {
    const createMany = jest.fn();
    const db = {
      workRequestDivisionCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-a', routeId: 'route-a', routeStep: { divisionId: 'division-a' }, route: { projection: { divisionCycleId: 'cycle-a' } } }) },
      divisionLead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-a' }) },
      workRequestTeamStep: { count: jest.fn().mockResolvedValue(1), createMany },
    };
    const subject = repository(db);
    await expect(context(() => subject.defineTeamSequence('request-a', 'cycle-a', ['team-a'], 'actor-a', 'lead-member-a'))).rejects.toMatchObject({ message: 'The Team sequence is frozen.' });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('requires the exact active Division Lead before defining Team work', async () => {
    const count = jest.fn();
    const db = {
      workRequestDivisionCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-a', routeId: 'route-a', routeStep: { divisionId: 'division-a' }, route: { projection: { divisionCycleId: 'cycle-a' } } }) },
      divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
      workRequestTeamStep: { count },
    };
    const subject = repository(db);
    await expect(context(() => subject.defineTeamSequence('request-a', 'cycle-a', ['team-a'], 'actor-a', 'other-member'))).rejects.toMatchObject({ status: 403 });
    expect(count).not.toHaveBeenCalled();
  });

  it('serializes Member submission and activates only the immediate next Member', async () => {
    const memberUpdate = jest.fn();
    const projectionUpdate = jest.fn();
    const eventCreate = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'member-step-a', memberId: 'member-a', routeId: 'route-a', teamStepId: 'team-step-a', ordinal: 1, activatedAt: new Date(), submittedAt: null, teamStep: { divisionCycleId: 'cycle-a', completedAt: null, divisionCycle: { completedAt: null } } })
          .mockResolvedValueOnce({ id: 'member-step-b' }),
        update: memberUpdate,
      },
      workRequestRouteProjection: { findFirst: jest.fn().mockResolvedValue({ memberStepId: 'member-step-a' }), update: projectionUpdate },
      workRequestRouteEvent: { create: eventCreate },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a'));
    expect(memberUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'member-step-a' }, data: expect.objectContaining({ submittedAt: expect.any(Date) }) }));
    expect(memberUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'member-step-b' }, data: expect.objectContaining({ activatedAt: expect.any(Date) }) }));
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ memberStepId: 'member-step-b' }) }));
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MEMBER_STEP_SUBMITTED' }) }));
  });

  it('rejects a non-target Member before writing a completed-history fact', async () => {
    const update = jest.fn();
    const db = {
      workRequestMemberStep: { findFirst: jest.fn().mockResolvedValue({ id: 'member-step-a', memberId: 'target-member', activatedAt: new Date(), submittedAt: null, teamStep: { completedAt: null, divisionCycle: { completedAt: null } } }), update },
    };
    const subject = repository(db);
    await expect(context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'other-member'))).rejects.toMatchObject({ status: 409 });
    expect(update).not.toHaveBeenCalled();
  });
});
