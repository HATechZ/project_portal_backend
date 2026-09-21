import { AppErrorCode } from '../common/exceptions/app-error-code';
import { DesignationService } from './designation.service';

describe('DesignationService', () => {
  const record = {
    id: 'designation-id',
    name: 'Engineer',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = () => ({
    companyId: jest.fn().mockResolvedValue('company-id'),
    duplicate: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue(record),
    find: jest.fn().mockResolvedValue(record),
    update: jest.fn().mockResolvedValue(record),
    hasMembers: jest.fn().mockResolvedValue(false),
    delete: jest.fn().mockResolvedValue(undefined),
  });

  it('creates trimmed names and excludes the current row from update duplicate checks', async () => {
    const repo = repository();
    const service = new DesignationService(repo as never);
    await service.create({ name: 'Engineer' });
    await service.update(record.id, { name: 'Engineer' });
    expect(repo.duplicate).toHaveBeenNthCalledWith(
      1,
      'Engineer',
      'company-id',
      undefined,
    );
    expect(repo.duplicate).toHaveBeenNthCalledWith(
      2,
      'Engineer',
      'company-id',
      record.id,
    );
  });

  it('maps normalized duplicates and referenced deletes to conflict', async () => {
    const repo = repository();
    repo.duplicate.mockResolvedValueOnce(true);
    const service = new DesignationService(repo as never);
    await expect(service.create({ name: ' engineer ' })).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
    repo.duplicate.mockResolvedValue(false);
    repo.hasMembers.mockResolvedValue(true);
    await expect(service.delete(record.id)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
