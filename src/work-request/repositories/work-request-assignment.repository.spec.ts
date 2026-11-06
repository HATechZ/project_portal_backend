import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import {
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestAssignmentRepository } from './work-request-assignment.repository';

describe('WorkRequestAssignmentRepository', () => {
  it('closes the prior active row, preserves history, inserts its successor, and appends the reassignment event', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({
      id: 'new-history',
      level: Level.TEAM,
      divisionId: null,
      teamId: 'team-b',
      memberId: null,
      assignedAt: new Date(),
    });
    const eventCreate = jest.fn().mockResolvedValue({});
    const repository = new WorkRequestAssignmentRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1Assignment: { updateMany, create },
          workRequestV1Event: { create: eventCreate },
        }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.write({
        workRequestId: 'request-a',
        level: Level.TEAM,
        targetId: 'team-b',
        actorId: 'actor-a',
        priorState: State.TEAM_ASSIGNED,
        resultingState: State.TEAM_ASSIGNED,
        action: 'TEAM_REASSIGNED',
        replacing: true,
      }),
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(eventCreate).toHaveBeenCalledTimes(1);
  });

  it('returns a domain conflict when the active assignment changed before reassignment', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn();
    const eventCreate = jest.fn();
    const repository = new WorkRequestAssignmentRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1Assignment: { updateMany, create },
          workRequestV1Event: { create: eventCreate },
        }),
    } as never);

    await expect(
      RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
        repository.write({
          workRequestId: 'request-a',
          level: Level.DIVISION,
          targetId: 'division-b',
          actorId: 'actor-a',
          priorState: State.DIVISION_ASSIGNED,
          resultingState: State.DIVISION_ASSIGNED,
          action: 'DIVISION_REASSIGNED',
          replacing: true,
        }),
      ),
    ).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
      status: 409,
    });
    expect(create).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('checks only the exact assigned Team for active Member membership', async () => {
    const memberFindFirst = jest.fn().mockResolvedValue(null);
    const repository = new WorkRequestAssignmentRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            findFirst: jest.fn().mockResolvedValue({
              bid: { client: { companyId: 'company-a' } },
              directProject: null,
              events: [{ resultingState: State.TEAM_ASSIGNED }],
              assignments: [
                { level: Level.DIVISION, divisionId: 'division-a' },
                { level: Level.TEAM, teamId: 'team-a' },
              ],
            }),
          },
          member: { findFirst: memberFindFirst },
          team: { findFirst: jest.fn() },
        }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.prepare('request-a', Level.MEMBER, 'member-a', null),
    );

    expect(memberFindFirst).toHaveBeenCalledTimes(1);
  });

  it('advances an initial route Division hand-off atomically with its assignment', async () => {
    const routeStepUpdate = jest.fn();
    const cycleUpdate = jest.fn();
    const cycleCreate = jest.fn();
    const projectionUpdate = jest.fn();
    const routeEventCreate = jest.fn();
    const repository = new WorkRequestAssignmentRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1Assignment: {
            create: jest.fn().mockResolvedValue({
              id: 'assignment-a',
              level: Level.DIVISION,
              divisionId: 'division-next',
              teamId: null,
              memberId: null,
              assignedAt: new Date(),
            }),
          },
          workRequestV1Event: {
            create: jest.fn().mockResolvedValue({
              id: 'event-a',
              action: 'DIVISION_ASSIGNED',
              occurredAt: new Date(),
            }),
          },
          workRequestRoute: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'route-a',
              projection: {
                routeVersionId: 'version-a',
                routeStepId: 'origin-step',
              },
            }),
          },
          workRequestRouteStep: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({
                id: 'origin-step',
                ordinal: 1,
                kind: 'ORIGIN_START',
                completedAt: null,
              })
              .mockResolvedValueOnce({ id: 'next-step' }),
            update: routeStepUpdate,
          },
          workRequestDivisionCycle: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'origin-cycle',
              completedAt: null,
              teamSteps: [],
            }),
            update: cycleUpdate,
            create: cycleCreate,
          },
          workRequestRouteProjection: { update: projectionUpdate },
          workRequestRouteEvent: { create: routeEventCreate },
        }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.write({
        workRequestId: 'request-a',
        level: Level.DIVISION,
        targetId: 'division-next',
        actorId: 'actor-a',
        priorState: State.CREATED,
        resultingState: State.DIVISION_ASSIGNED,
        action: 'DIVISION_ASSIGNED',
        replacing: false,
      }),
    );

    expect(routeStepUpdate).toHaveBeenCalledTimes(2);
    expect(cycleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'origin-cycle' },
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      }),
    );
    expect(cycleCreate).toHaveBeenCalledTimes(1);
    expect(projectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routeStepId: 'next-step',
          teamStepId: null,
          memberStepId: null,
        }),
      }),
    );
    expect(routeEventCreate).toHaveBeenCalledTimes(2);
  });
});
