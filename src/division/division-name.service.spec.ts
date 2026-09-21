import { AppErrorCode } from '../common/exceptions/app-error-code';
import { DivisionService } from './division.service';

describe('DivisionService normalized names', () => {
  const division = {
    id: 'division-id',
    name: 'Engineering',
    abbr: 'ENG',
    divisionTypeId: null,
    divisionType: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  it('rejects normalized create and update duplicates while excluding self', async () => {
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue({ id: 'company-id' }),
      duplicateName: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      findById: jest.fn().mockResolvedValue(division),
      findDivisionType: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(division),
    };
    const service = new DivisionService(repository as never, {} as never);
    await expect(
      service.create({ name: ' engineering ', abbr: 'ENG' }),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    await service.update(division.id, { name: 'Engineering' });
    expect(repository.duplicateName).toHaveBeenLastCalledWith(
      'Engineering',
      'company-id',
      division.id,
    );
  });
});
