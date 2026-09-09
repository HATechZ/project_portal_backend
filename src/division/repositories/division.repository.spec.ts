/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { RequestContext } from '../../common/context/request-context';
import { DivisionRepository } from './division.repository';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const divisionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function repositoryWithDb(db: Record<string, unknown>) {
  const unitOfWork = {
    execute: jest.fn((work: (transaction: unknown) => Promise<unknown>) =>
      work(db),
    ),
  };
  return {
    repository: new DivisionRepository(unitOfWork as never),
    unitOfWork,
  };
}

function inTenant<T>(work: () => T): T {
  return RequestContext.run({ requestId: 'request-id', tenantId }, work);
}

describe('DivisionRepository', () => {
  it('scopes list and count by tenantId and companyId', async () => {
    const db = {
      division: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const { repository } = repositoryWithDb(db);

    await inTenant(() => repository.findAll(companyId, { skip: 20, take: 10 }));
    await inTenant(() => repository.count(companyId));

    expect(db.division.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, companyId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 20,
        take: 10,
      }),
    );
    expect(db.division.count).toHaveBeenCalledWith({
      where: { tenantId, companyId },
    });
  });

  it('generates IDs and never accepts ownership fields on create', async () => {
    const db = {
      division: {
        create: jest.fn().mockResolvedValue({ id: divisionId }),
      },
    };
    const { repository } = repositoryWithDb(db);

    await inTenant(() =>
      repository.create(companyId, {
        name: ' Engineering ',
        abbr: ' ENG ',
        divisionTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    );

    expect(db.division.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        id: expect.any(String),
        companyId,
        name: 'Engineering',
        abbr: 'ENG',
        divisionTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
      select: expect.any(Object),
    });
    expect(db.division.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          memberId: expect.anything(),
          userId: expect.anything(),
          teamId: expect.anything(),
          leadMemberId: expect.anything(),
          membersByDivisionId: expect.anything(),
          teamsByDivisionId: expect.anything(),
        }),
      }),
    );
  });

  it('updates only allowed mutable fields inside the scoped unique key', async () => {
    const db = {
      division: {
        update: jest.fn().mockResolvedValue({ id: divisionId }),
      },
    };
    const { repository } = repositoryWithDb(db);

    await inTenant(() =>
      repository.update(divisionId, companyId, {
        name: ' Operations ',
        abbr: ' OPS ',
      }),
    );

    expect(db.division.update).toHaveBeenCalledWith({
      where: { id_tenantId_companyId: { id: divisionId, tenantId, companyId } },
      data: expect.objectContaining({
        name: 'Operations',
        abbr: 'OPS',
        updatedAt: expect.any(Date),
      }),
      select: expect.any(Object),
    });
    expect(db.division.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ id: expect.anything() }),
      }),
    );
    expect(db.division.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ isActive: expect.anything() }),
      }),
    );
  });

  it('audits every current inverse relation before hard delete', async () => {
    const db = {
      division: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: divisionId })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: divisionId })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: divisionId }),
      },
    };
    const { repository } = repositoryWithDb(db);

    const blockers = await inTenant(() =>
      repository.findDeleteBlockers(divisionId, companyId),
    );

    expect(blockers).toEqual([
      'membersByDivisionId',
      'projectsByOriginDivisionId',
      'workRequestsByOriginDivisionId',
    ]);
    expect(db.division.findFirst).toHaveBeenCalledTimes(5);
    expect(db.division.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ membersByDivisionId: { some: {} } }),
      }),
    );
    expect(db.division.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ teamsByDivisionId: { some: {} } }),
      }),
    );
    expect(db.division.findFirst).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          projectsByOriginDivisionId: { some: {} },
        }),
      }),
    );
    expect(db.division.findFirst).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          workRequestsByAssignedDivisionId: { some: {} },
        }),
      }),
    );
    expect(db.division.findFirst).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        where: expect.objectContaining({
          workRequestsByOriginDivisionId: { some: {} },
        }),
      }),
    );
  });
});
