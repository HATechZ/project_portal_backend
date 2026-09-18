import { AppErrorCode } from '../common/exceptions/app-error-code';
import { VesselCodeService } from './vessel-code.service';

const row = {
  id: 'vessel-id',
  name: 'Fixture Vessel',
  code: 'CA2',
  sortOrder: 0,
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
    update: jest.fn().mockResolvedValue({ ...row, code: 'EXT' }),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    isReferenced: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { repository, service: new VesselCodeService(repository as never) };
}

describe('VesselCodeService', () => {
  it('supports empty list, create, get, and unreferenced update', async () => {
    const { service, repository } = createService();
    await expect(service.findAll()).resolves.toEqual([]);
    await expect(
      service.create({ name: 'Fixture Vessel', code: 'CA2' }, manager),
    ).resolves.toMatchObject(row);
    await expect(service.findOne(row.id)).resolves.toMatchObject(row);
    await service.update(row.id, { code: 'EXT' }, manager);
    expect(repository.duplicate).toHaveBeenCalledWith(row.name, 'EXT', row.id);
  });

  it('rejects trimmed/case-insensitive normalized name or code duplicates', async () => {
    const { service } = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    });
    await expect(
      service.create({ name: ' fixture vessel ', code: ' ca2 ' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('deactivates/reactivates and rejects an already-active value', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: true });
    await expect(service.reactivate(row.id, manager)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
  });

  it('uses temporary referenced-edit safety and tenant-wide scope', async () => {
    const referenced = createService({
      isReferenced: jest.fn().mockResolvedValue(true),
    }).service;
    const scoped = createService().service;
    await expect(
      referenced.update(row.id, { code: 'EXT' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    await expect(
      scoped.create({ name: 'Fixture Vessel', code: 'CA2' }, {
        tenantWide: false,
      } as never),
    ).rejects.toMatchObject({ code: AppErrorCode.OutOfScope });
  });
});
