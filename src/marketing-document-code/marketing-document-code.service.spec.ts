import { AppErrorCode } from '../common/exceptions/app-error-code';
import { MarketingDocumentCodeService } from './marketing-document-code.service';

const row = {
  id: 'document-code-id',
  code: '001',
  name: 'Project Information',
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
    service: new MarketingDocumentCodeService(repository as never),
  };
}

describe('MarketingDocumentCodeService', () => {
  it('defaults the list to active and supports inactive and all filters', async () => {
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

  it('creates normalized leading-zero codes and allows referenced updates', async () => {
    const { service, repository } = createService();
    await service.create({ code: '001', name: 'Project Information' });
    await service.update(row.id, { code: 'ABC', description: 'Changed' });
    expect(repository.create).toHaveBeenCalledWith({
      code: '001',
      name: 'Project Information',
    });
    expect(repository.update).toHaveBeenCalledWith(row.id, {
      code: 'ABC',
      description: 'Changed',
    });
  });

  it('rejects duplicates, empty updates, missing rows, and repeated lifecycle state', async () => {
    const duplicate = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    }).service;
    await expect(
      duplicate.create({ code: '001', name: 'Info' }),
    ).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
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

  it('deactivates and reactivates only when the current state changes', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id);
    expect(repository.setActive).toHaveBeenCalledWith(row.id, false);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id);
    expect(repository.setActive).toHaveBeenLastCalledWith(row.id, true);
  });
});
