import { AppErrorCode } from '../common/exceptions/app-error-code';
import { PodCodeService } from './pod-code.service';

const row = {
  id: 'pod-id',
  name: 'Mexico',
  code: null,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const manager = { tenantWide: true } as never;

function createService(overrides: Record<string, unknown> = {}) {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockResolvedValue(row),
    duplicate: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue({ ...row, name: 'India' }),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    isReferenced: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { repository, service: new PodCodeService(repository as never) };
}

describe('PodCodeService', () => {
  it('supports empty active and inactive-inclusive lists, create, and get without code', async () => {
    const { service, repository } = createService();
    await expect(service.findAll()).resolves.toEqual([]);
    await service.findAll(true);
    await expect(
      service.create({ name: 'Mexico' }, manager),
    ).resolves.not.toHaveProperty('code');
    await expect(service.findOne(row.id)).resolves.toMatchObject({
      name: 'Mexico',
    });
    expect(repository.list).toHaveBeenNthCalledWith(1, false);
    expect(repository.list).toHaveBeenNthCalledWith(2, true);
  });

  it('updates an unreferenced POD and detects normalized whitespace duplicates', async () => {
    const { service, repository } = createService();
    await service.update(row.id, { name: 'India' }, manager);
    expect(repository.duplicate).toHaveBeenCalledWith(
      'India',
      undefined,
      row.id,
    );
    const duplicate = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    }).service;
    await expect(
      duplicate.create({ name: ' mexico ' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('deactivates/reactivates and rejects already-inactive or already-active values', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: true });
    await expect(service.reactivate(row.id, manager)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
    const inactive = createService({
      find: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    }).service;
    await expect(inactive.deactivate(row.id, manager)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
  });

  it('uses temporary referenced-edit safety and tenant-wide management scope', async () => {
    const referenced = createService({
      isReferenced: jest.fn().mockResolvedValue(true),
    }).service;
    const scoped = createService().service;
    await expect(
      referenced.update(row.id, { name: 'India' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    await expect(
      scoped.create({ name: 'Mexico' }, { tenantWide: false } as never),
    ).rejects.toMatchObject({ code: AppErrorCode.OutOfScope });
  });
});
