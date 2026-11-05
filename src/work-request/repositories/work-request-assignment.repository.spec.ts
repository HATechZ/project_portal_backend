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
});
