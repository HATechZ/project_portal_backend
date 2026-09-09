import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { DivisionService } from './division.service';
import { DivisionRepository } from './repositories';

const division = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Engineering',
  abbr: 'ENG',
  divisionTypeId: null,
  divisionType: null,
  isActive: true,
  createdAt: new Date('2026-09-09T01:00:00.000Z'),
  updatedAt: new Date('2026-09-09T01:00:00.000Z'),
};

function repositoryMock() {
  return {
    findScopedCompany: jest.fn().mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    }),
    findAll: jest.fn().mockResolvedValue([division]),
    count: jest.fn().mockResolvedValue(1),
    findById: jest.fn().mockResolvedValue(division),
    create: jest.fn().mockResolvedValue(division),
    update: jest.fn().mockResolvedValue({ ...division, name: 'Operations' }),
    delete: jest.fn().mockResolvedValue(undefined),
    findDivisionType: jest.fn().mockResolvedValue({ id: 'type-id' }),
    findDeleteBlockers: jest.fn().mockResolvedValue([]),
  } satisfies Partial<Record<keyof DivisionRepository, jest.Mock>>;
}

describe('DivisionService', () => {
  it('maps scoped paginated divisions without ownership fields', async () => {
    const repository = repositoryMock();
    const service = new DivisionService(
      repository as unknown as DivisionRepository,
    );

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(repository.findAll).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      { skip: 0, take: 20 },
    );
    expect(result.items).toEqual([
      {
        id: division.id,
        name: division.name,
        abbr: division.abbr,
        divisionTypeId: null,
        divisionType: null,
        isActive: true,
        createdAt: division.createdAt,
        updatedAt: division.updatedAt,
      },
    ]);
    expect(result.items[0]).not.toHaveProperty('tenantId');
    expect(result.items[0]).not.toHaveProperty('companyId');
  });

  it('creates only through the scoped Company and validates DivisionType', async () => {
    const repository = repositoryMock();
    const service = new DivisionService(
      repository as unknown as DivisionRepository,
    );

    await service.create({
      name: ' Engineering ',
      abbr: ' ENG ',
      divisionTypeId: '33333333-3333-4333-8333-333333333333',
    });

    expect(repository.findDivisionType).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
    );
    expect(repository.create).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      {
        name: ' Engineering ',
        abbr: ' ENG ',
        divisionTypeId: '33333333-3333-4333-8333-333333333333',
      },
    );
  });

  it('rejects an empty update before writing', async () => {
    const service = new DivisionService(
      repositoryMock() as unknown as DivisionRepository,
    );

    await expect(service.update(division.id, {})).rejects.toMatchObject({
      code: AppErrorCode.BadRequest,
    });
  });

  it('returns 404 for a missing or foreign scoped Division', async () => {
    const repository = repositoryMock();
    repository.findById.mockResolvedValue(null);
    const service = new DivisionService(
      repository as unknown as DivisionRepository,
    );

    await expect(service.findOne(division.id)).rejects.toMatchObject({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('blocks hard delete when any dependency exists', async () => {
    const repository = repositoryMock();
    repository.findDeleteBlockers.mockResolvedValue([
      'membersByDivisionId',
      'teamsByDivisionId',
      'projectsByOriginDivisionId',
      'workRequestsByAssignedDivisionId',
      'workRequestsByOriginDivisionId',
    ]);
    const service = new DivisionService(
      repository as unknown as DivisionRepository,
    );

    await expect(service.delete(division.id)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('raises AppException for an unknown DivisionType', async () => {
    const repository = repositoryMock();
    repository.findDivisionType.mockResolvedValue(null);
    const service = new DivisionService(
      repository as unknown as DivisionRepository,
    );

    await expect(
      service.create({
        name: 'Engineering',
        abbr: 'ENG',
        divisionTypeId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
