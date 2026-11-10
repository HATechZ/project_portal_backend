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

  it('allows a tenant-wide internal administrator to define Team work without a Division Lead link', async () => {
    const createMany = jest.fn();
    const db = {
      workRequestDivisionCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-a', routeId: 'route-a', routeStep: { divisionId: 'division-a' }, route: { projection: { divisionCycleId: 'cycle-a' } } }) },
      workRequestTeamStep: { count: jest.fn().mockResolvedValue(0), createMany },
      team: { findMany: jest.fn().mockResolvedValue([{ id: 'team-a' }]) },
      workRequestRouteProjection: { update: jest.fn() },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() => subject.defineTeamSequence('request-a', 'cycle-a', ['team-a'], 'admin-a', null, true));
    expect(createMany).toHaveBeenCalled();
  });

  it('serializes Member submission and activates only the immediate next Member', async () => {
    const memberUpdate = jest.fn();
    const projectionUpdate = jest.fn();
    const eventCreate = jest.fn();
    const submissionCreate = jest.fn();
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
      workRequestMemberStepSubmission: { create: submissionCreate },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a'));
    expect(memberUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'member-step-a' }, data: expect.objectContaining({ submittedAt: expect.any(Date) }) }));
    expect(memberUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'member-step-b' }, data: expect.objectContaining({ activatedAt: expect.any(Date) }) }));
    expect(db.workRequestMemberStep.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-a', teamStepId: 'team-step-a', ordinal: { gt: 1 },
        cancelledAt: null, activatedAt: null, submittedAt: null,
      },
      orderBy: { ordinal: 'asc' },
    });
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ memberStepId: 'member-step-b' }) }));
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MEMBER_STEP_SUBMITTED' }) }));
    expect(submissionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ message: null, documents: { create: [] } }) }));
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

  it('persists an optional message and deduplicated existing document versions in first-supplied order', async () => {
    const create = jest.fn();
    const db = {
      workRequestMemberStep: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'member-step-a', memberId: 'member-a', routeId: 'route-a', teamStepId: 'team-step-a', ordinal: 1, activatedAt: new Date(), submittedAt: null, teamStep: { divisionCycleId: 'cycle-a', completedAt: null, divisionCycle: { completedAt: null } } }).mockResolvedValueOnce(null), update: jest.fn() },
      workRequestRouteProjection: { findFirst: jest.fn().mockResolvedValue({ memberStepId: 'member-step-a' }), update: jest.fn() },
      workRequestV1DocumentVersion: { count: jest.fn().mockResolvedValue(2) },
      workRequestMemberStepSubmission: { create }, workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db); jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a', { message: 'Completed', documentVersionIds: ['version-a', 'version-b', 'version-a'] }));
    expect(db.workRequestV1DocumentVersion.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', id: { in: ['version-a', 'version-b'] }, document: { workRequestId: 'request-a' } } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ message: 'Completed', documents: { create: [expect.objectContaining({ documentVersionId: 'version-a', position: 0 }), expect.objectContaining({ documentVersionId: 'version-b', position: 1 })] } }) }));
    // Prisma inherits tenantId and submissionId from the composite parent
    // relation; supplying either in CreateWithoutSubmission is invalid.
    for (const link of create.mock.calls[0][0].data.documents.create) {
      expect(Object.keys(link).sort()).toEqual(['documentVersionId', 'id', 'position']);
    }
  });

  it.each(['another Work Request', 'another tenant', 'missing/deleted'])('rejects a %s document version before changing workflow state', async () => {
    const update = jest.fn();
    const db = {
      workRequestMemberStep: { findFirst: jest.fn().mockResolvedValue({ id: 'member-step-a', memberId: 'member-a', routeId: 'route-a', teamStepId: 'team-step-a', ordinal: 1, activatedAt: new Date(), submittedAt: null, teamStep: { divisionCycleId: 'cycle-a', completedAt: null, divisionCycle: { completedAt: null } } }), update },
      workRequestRouteProjection: { findFirst: jest.fn().mockResolvedValue({ memberStepId: 'member-step-a' }) },
      workRequestV1DocumentVersion: { count: jest.fn().mockResolvedValue(0) }, workRequestMemberStepSubmission: { create: jest.fn() },
    };
    const subject = repository(db);
    await expect(context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a', { documentVersionIds: ['foreign-version'] }))).rejects.toMatchObject({ status: 400 });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an inactive Member step before creating a submission', async () => {
    const create = jest.fn();
    const db = { workRequestMemberStep: { findFirst: jest.fn().mockResolvedValue({ id: 'member-step-a', memberId: 'member-a', activatedAt: null, submittedAt: null, teamStep: { completedAt: null, divisionCycle: { completedAt: null } } }), update: jest.fn() }, workRequestMemberStepSubmission: { create } };
    const subject = repository(db);
    await expect(context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a'))).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it('leaves no active Member projection after the final Member submits, returning completion responsibility to the Team Lead', async () => {
    const projectionUpdate = jest.fn();
    const db = {
      workRequestMemberStep: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'member-step-a', memberId: 'member-a', routeId: 'route-a', teamStepId: 'team-step-a', ordinal: 2, activatedAt: new Date(), submittedAt: null, teamStep: { divisionCycleId: 'cycle-a', completedAt: null, divisionCycle: { completedAt: null } } }).mockResolvedValueOnce(null), update: jest.fn() },
      workRequestRouteProjection: { findFirst: jest.fn().mockResolvedValue({ memberStepId: 'member-step-a' }), update: projectionUpdate },
      workRequestMemberStepSubmission: { create: jest.fn() }, workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db); jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() => subject.submitMemberStep('request-a', 'member-step-a', 'actor-a', 'member-a'));
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ memberStepId: null }) }));
    expect(db.workRequestMemberStep.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-a', teamStepId: 'team-step-a', ordinal: { gt: 2 },
        cancelledAt: null, activatedAt: null, submittedAt: null,
      },
      orderBy: { ordinal: 'asc' },
    });
  });
});
