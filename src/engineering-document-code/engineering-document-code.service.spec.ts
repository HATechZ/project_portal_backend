import { AppErrorCode } from '../common/exceptions/app-error-code';
import { EngineeringDocumentCodeService } from './engineering-document-code.service';

const row = {
  id: 'code-id',
  code: '700',
  name: 'Custom Engineering Code',
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
    update: jest.fn().mockResolvedValue(row),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    ...overrides,
  };
  return {
    repository,
    service: new EngineeringDocumentCodeService(repository as never),
  };
}
describe('EngineeringDocumentCodeService', () => {
  it('lists active, inactive, and all records', async () => {
    const { service, repository } = createService();
    await service.findAll();
    await service.findDeactivated();
    await service.findAll('all');
    expect(repository.list).toHaveBeenNthCalledWith(1, 'active');
    expect(repository.list).toHaveBeenNthCalledWith(2, 'inactive');
    expect(repository.list).toHaveBeenNthCalledWith(3, 'all');
  });
  it('creates generic codes without a numeric-range check', async () => {
    const { service, repository } = createService();
    await service.create({ code: '700', name: 'Custom Engineering Code' });
    expect(repository.create).toHaveBeenCalledWith({
      code: '700',
      name: 'Custom Engineering Code',
    });
  });
  it('maps duplicate, empty update, missing and repeated lifecycle state errors', async () => {
    await expect(
      createService({
        duplicate: jest.fn().mockResolvedValue(true),
      }).service.create({ code: '700', name: 'Custom' }),
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
});
