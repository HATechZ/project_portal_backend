import { CustomRoleScope, WorkRequestRouteRevisionClassification as Classification } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestRevisionRepository } from './work-request-revision.repository';

describe('WorkRequestRevisionRepository Phase 5 lifecycle guards', () => {
  const context = <T>(work: () => Promise<T>) =>
    RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, work);

  it('preserves the requester context and pauses it on a direct Member revision', async () => {
    const revisionCreate = jest.fn();
    const projectionUpdate = jest.fn();
    const eventCreate = jest.fn();
    const execute = jest.fn((work) => work({
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'route-step-a', divisionCycleId: 'cycle-a', teamStepId: 'team-step-a', memberStepId: 'member-step-a', openRevisionId: null } }) },
      workRequestMemberStep: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'member-step-a' }).mockResolvedValueOnce({ id: 'member-step-d', teamStepId: 'team-step-a', memberId: 'member-d' }) },
      actorProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'actor-d' }) },
      workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _max: { roundNumber: 2 } }), create: revisionCreate, findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'revision-a' }) },
      workRequestRouteProjection: { update: projectionUpdate },
      workRequestRouteEvent: { create: eventCreate },
    }));
    const subject = new WorkRequestRevisionRepository({ execute } as never);
    await context(() => subject.request('request-a', 'actor-a', 'member-a', { classification: Classification.INTERNAL_MEMBER, sourceActorId: 'actor-d', sourceMemberStepId: 'member-step-d', reason: 'Correct calculation.' }));
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ classification: Classification.INTERNAL_MEMBER, roundNumber: 3, requesterRouteStepId: 'route-step-a', resumeRouteStepId: 'route-step-a', sourceMemberStepId: 'member-step-d' }) }));
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ openRevisionId: expect.any(String) }) }));
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REVISION_REQUESTED' }) }));
    expect(execute).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });

  it('emits the sole formal trigger only for a committed cross-Division revision', async () => {
    const eventCreate = jest.fn();
    const db = {
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'route-step-a', divisionCycleId: 'cycle-a', teamStepId: null, memberStepId: null, openRevisionId: null } }) },
      workRequestDivisionCycle: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'cycle-a', routeStep: { divisionId: 'division-a' } }).mockResolvedValueOnce({ id: 'cycle-d', routeStepId: 'route-step-d', routeStep: { divisionId: 'division-d' } }) },
      divisionLead: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'lead-a' }).mockResolvedValueOnce({ memberId: 'member-d' }) },
      actorProfile: { findFirst: jest.fn().mockResolvedValueOnce({ memberId: 'member-d' }).mockResolvedValueOnce({ id: 'actor-d' }) },
      workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _max: { roundNumber: null } }), create: jest.fn(), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'revision-a' }) },
      workRequestRouteProjection: { update: jest.fn() },
      workRequestRouteEvent: { create: eventCreate },
    };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await context(() => subject.request('request-a', 'actor-a', 'member-a', { classification: Classification.CROSS_DIVISION_FORMAL, sourceActorId: 'actor-d', sourceDivisionCycleId: 'cycle-d', reason: 'Upstream correction.' }));
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FORMAL_REVISION_TRIGGERED' }) }));
  });

  it('permits direct Team-to-Team correction only within the preserved Division cycle', async () => {
    const revisionCreate = jest.fn();
    const db = {
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'route-step-a', divisionCycleId: 'cycle-a', teamStepId: 'team-step-a', memberStepId: null, openRevisionId: null } }) },
      workRequestTeamStep: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'team-step-a', team: { leadMemberId: 'lead-a' } }).mockResolvedValueOnce({ id: 'team-step-c', divisionCycleId: 'cycle-a', team: { leadMemberId: 'lead-c' } }) },
      actorProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'actor-c' }) },
      workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _max: { roundNumber: 1 } }), create: revisionCreate, findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'revision-a' }) },
      workRequestRouteProjection: { update: jest.fn() },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await context(() => subject.request('request-a', 'actor-a', 'lead-a', { classification: Classification.INTERNAL_TEAM, sourceActorId: 'actor-c', sourceTeamStepId: 'team-step-c', reason: 'Team correction.' }));
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceTeamStepId: 'team-step-c', resumeTeamStepId: 'team-step-a' }) }));
  });

  it('returns an idempotent revision without appending a second pause event', async () => {
    const create = jest.fn();
    const eventCreate = jest.fn();
    const db = {
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { openRevisionId: null } }) },
      workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue({ id: 'revision-existing' }), create },
      workRequestRouteEvent: { create: eventCreate },
    };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    const result = await context(() => subject.request('request-a', 'actor-a', 'member-a', { classification: Classification.INTERNAL_MEMBER, sourceActorId: 'actor-d', sourceMemberStepId: 'member-step-d', reason: 'retry', idempotencyKey: 'request-a' }));
    expect(result).toEqual({ revision: { id: 'revision-existing' }, event: null });
    expect(create).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('restores only the preserved requester context when the exact source resubmits', async () => {
    const projectionUpdate = jest.fn();
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue({ id: 'revision-a', routeId: 'route-a', sourceActorId: 'actor-d', classification: Classification.INTERNAL_MEMBER, submittedAt: null, resumedAt: null, sourceActor: { memberId: 'member-d' }, route: { projection: { openRevisionId: 'revision-a' } }, resumeRouteStepId: 'route-step-a', resumeDivisionCycleId: 'cycle-a', resumeTeamStepId: 'team-step-a', resumeMemberStepId: 'member-step-a' }), updateMany, findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'revision-a' }) },
      workRequestRouteProjection: { update: projectionUpdate },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await context(() => subject.resubmit('request-a', 'revision-a', 'actor-d', 'member-d', CustomRoleScope.member));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ submittedAt: null, resumedAt: null }) }));
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ routeStepId: 'route-step-a', memberStepId: 'member-step-a', openRevisionId: null }) }));
  });

  it('rejects a non-source actor without resuming the paused context', async () => {
    const updateMany = jest.fn();
    const db = { workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue({ sourceActorId: 'actor-d', sourceActor: { memberId: 'member-d' } }), updateMany } };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await expect(context(() => subject.resubmit('request-a', 'revision-a', 'actor-x', 'member-x', CustomRoleScope.member))).rejects.toMatchObject({ status: 403 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a different actor profile for the same source Member', async () => {
    const updateMany = jest.fn();
    const db = { workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue({ sourceActorId: 'actor-d', sourceActor: { memberId: 'member-d' }, classification: Classification.INTERNAL_MEMBER }), updateMany } };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await expect(context(() => subject.resubmit('request-a', 'revision-a', 'actor-d-other-role', 'member-d', CustomRoleScope.member))).rejects.toMatchObject({ status: 403 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects cross-Division resume from a Member-scoped actor', async () => {
    const updateMany = jest.fn();
    const db = { workRequestRouteRevision: { findFirst: jest.fn().mockResolvedValue({ sourceActorId: 'actor-d', sourceActor: { memberId: 'member-d' }, classification: Classification.CROSS_DIVISION_FORMAL }), updateMany } };
    const subject = new WorkRequestRevisionRepository({ execute: (work) => work(db) } as never);
    await expect(context(() => subject.resubmit('request-a', 'revision-a', 'actor-d', 'member-d', CustomRoleScope.member))).rejects.toMatchObject({ status: 403 });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
