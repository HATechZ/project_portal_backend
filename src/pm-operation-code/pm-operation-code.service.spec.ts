import { AppErrorCode } from '../common/exceptions/app-error-code';
import { PmOperationDocumentCodeService } from './pm-operation-code.service';

const row = {
  id: 'document-code-id',
  code: '1000',
  name: 'Custom ETC Code',
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(overrides: Record<string, unknown> = {}) {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockResolvedValue(row),
    duplicate: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue({ ...row, name: 'Updated' }),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    ...overrides,
  };
  return {
    repository,
    service: new PmOperationDocumentCodeService(repository as never),
  };
}

describe('PmOperationDocumentCodeService', () => {
  it('lists active, inactive, and all records', async () => {
    const { service, repository } = createService();
    await service.findAll();
    await service.findDeactivated();
    await service.findAll('inactive');
    await service.findAll('all');
    expect(repository.list).toHaveBeenNthCalledWith(1, 'active');
    expect(repository.list).toHaveBeenNthCalledWith(2, 'inactive');
    expect(repository.list).toHaveBeenNthCalledWith(3, 'inactive');
    expect(repository.list).toHaveBeenNthCalledWith(4, 'all');
  });

  it('creates codes outside the historical ETC numbering convention', async () => {
    const { service, repository } = createService();
    await service.create({ code: '1000', name: 'Custom ETC Code' });
    expect(repository.create).toHaveBeenCalledWith({
      code: '1000',
      name: 'Custom ETC Code',
    });
  });

  it('rejects duplicates, empty updates, missing rows, and repeated lifecycle state', async () => {
    const duplicate = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    }).service;
    await expect(
      duplicate.create({ code: '1000', name: 'Custom ETC Code' }),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    const { service } = createService();
    await expect(service.update(row.id, {})).rejects.toMatchObject({
      code: AppErrorCode.BadRequest,
    });
    await expect(service.reactivate(row.id)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
    await expect(
      createService({
        find: jest.fn().mockResolvedValue(null),
      }).service.findOne(row.id),
    ).rejects.toMatchObject({ code: AppErrorCode.NotFound });
  });

  it('deactivates and reactivates through the ETC repository only', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id);
    expect(repository.setActive).toHaveBeenCalledWith(row.id, false);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id);
    expect(repository.setActive).toHaveBeenLastCalledWith(row.id, true);
  });
});


