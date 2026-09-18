import { AppErrorCode } from '../common/exceptions/app-error-code';
import { CargoCodeService } from './cargo-code.service';

const row = {
  id: 'cargo-id',
  name: 'Crane',
  code: 'CRA',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const manager = { tenantWide: true } as never;

function createService(overrides: Record<string, unknown> = {}) {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockResolvedValue(row),
    duplicate: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue({ ...row, name: 'Rig', code: 'RIG' }),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    isReferenced: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { repository, service: new CargoCodeService(repository as never) };
}

describe('CargoCodeService', () => {
  it('lists empty values, creates, and gets a Cargo Code', async () => {
    const { service, repository } = createService();
    await expect(service.findAll()).resolves.toEqual([]);
    await expect(
      service.create({ name: 'Crane', code: 'CRA' }, manager),
    ).resolves.toMatchObject(row);
    await expect(service.findOne(row.id)).resolves.toMatchObject(row);
    expect(repository.list).toHaveBeenCalledWith(false);
  });

  it('updates an unreferenced Cargo Code', async () => {
    const { service, repository } = createService();
    await service.update(row.id, { name: 'Rig', code: 'RIG' }, manager);
    expect(repository.duplicate).toHaveBeenCalledWith('Rig', 'RIG', row.id);
    expect(repository.update).toHaveBeenCalledWith(row.id, {
      name: 'Rig',
      code: 'RIG',
    });
  });

  it('rejects normalized name and case-insensitive code duplicates', async () => {
    const { service } = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    });
    await expect(
      service.create({ name: ' crane ', code: ' cra ' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('deactivates, reactivates, and rejects an already-active request', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: true });
    await expect(service.reactivate(row.id, manager)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
  });

  it('uses temporary historical safety and tenant-wide scope', async () => {
    const referenced = createService({
      isReferenced: jest.fn().mockResolvedValue(true),
    }).service;
    const scoped = createService().service;
    await expect(
      referenced.update(row.id, { code: 'RIG' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    await expect(
      scoped.create({ name: 'Crane', code: 'CRA' }, {
        tenantWide: false,
      } as never),
    ).rejects.toMatchObject({ code: AppErrorCode.OutOfScope });
  });
});
