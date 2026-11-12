import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../../config/configuration';
import { RequestContext } from '../../common/context/request-context';
import { PrismaService } from './prisma.service';
import { ResponsibilityHistoryAdapter } from './responsibility-history.adapter';
import { UnitOfWorkService } from './unit-of-work.service';
import type { ResponsibilityAssignment } from '../../contracts/work-request-responsibility-history.port';

const assignment: ResponsibilityAssignment = {
  tenantId: 'tenant-a',
  workRequestId: 'request-a',
  routeId: 'route-a',
  actorProfileId: 'actor-a',
  sourceMemberId: 'member-a',
  sourceUserId: 'user-a',
  sourceRoleId: 'role-a',
  selectionPolicy: 'CONTEXT_UNIQUE',
  responsibilityType: 'TEAM',
  divisionCycleId: 'cycle-a',
  teamStepId: 'team-a',
  sourceDivisionLeadId: null,
  assignmentKey: 'assignment-a',
  startedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('ResponsibilityHistoryAdapter transaction boundary', () => {
  it('rejects a root Prisma client before any history query', async () => {
    const prisma = new PrismaService(
      new ConfigService<AppConfiguration, true>(),
    );
    const adapter = new ResponsibilityHistoryAdapter(
      new UnitOfWorkService(prisma),
    );
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        adapter.recordAssignment(assignment, prisma),
      ),
    ).rejects.toThrow(
      'Responsibility history requires the active tenant transaction.',
    );
  });

  it('accepts an exact retry without rewriting closed history and rejects a mismatched actor', async () => {
    const prisma = new PrismaService(
      new ConfigService<AppConfiguration, true>(),
    );
    const uow = new UnitOfWorkService(prisma);
    const tx = prisma.scoped;
    jest.spyOn(uow, 'inTransaction', 'get').mockReturnValue(true);
    jest.spyOn(uow, 'client', 'get').mockReturnValue(tx);
    const history = {
      ...assignment,
      id: 'history-a',
      evidenceKind: 'ASSIGNMENT',
      evidenceAt: null,
      evidenceEventId: null,
      endedAt: new Date('2026-01-02T00:00:00Z'),
      createdAt: assignment.startedAt,
    };
    jest
      .spyOn(tx.workRequestResponsibilityHistory, 'findUnique')
      .mockResolvedValue(history);
    const create = jest.spyOn(tx.workRequestResponsibilityHistory, 'create');
    const adapter = new ResponsibilityHistoryAdapter(uow);
    await RequestContext.run({ tenantId: 'tenant-a' }, () =>
      adapter.recordAssignment(assignment, tx),
    );
    expect(create).not.toHaveBeenCalled();
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        adapter.recordAssignment(
          { ...assignment, actorProfileId: 'other' },
          tx,
        ),
      ),
    ).rejects.toThrow('retry identity conflicts');
  });
});
