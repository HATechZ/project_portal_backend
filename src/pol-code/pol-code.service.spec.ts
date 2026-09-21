import { AppErrorCode } from '../common/exceptions/app-error-code';
import { PolCodeService } from './pol-code.service';

const row = {
  id: 'pol-id',
  name: 'Korea',
  code: null,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const manager = { tenantWide: true } as never;

function createService(overrides: Record<string, unknown> = {}) {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    listDeactivated: jest.fn().mockResolvedValue([{ ...row, isActive: false }]),
    find: jest.fn().mockResolvedValue(row),
    duplicate: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue({ ...row, name: 'Japan' }),
    setActive: jest.fn().mockResolvedValue({ ...row, isActive: false }),
    isReferenced: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { repository, service: new PolCodeService(repository as never) };
}

describe('PolCodeService', () => {
  it('returns an empty active list and can include inactive values', async () => {
    const { service, repository } = createService();
    await expect(service.findAll()).resolves.toEqual([]);
    await service.findAll(true);
    expect(repository.list).toHaveBeenNthCalledWith(1, false);
    expect(repository.list).toHaveBeenNthCalledWith(2, true);
    await expect(service.findDeactivated()).resolves.toEqual([
      expect.objectContaining({ isActive: false }),
    ]);
    expect(repository.listDeactivated).toHaveBeenCalledTimes(1);
  });

  it('creates and gets a POL without exposing code', async () => {
    const { service, repository } = createService();
    await expect(
      service.create({ name: 'Korea' }, manager),
    ).resolves.not.toHaveProperty('code');
    await expect(service.findOne(row.id)).resolves.toMatchObject({
      id: row.id,
      name: row.name,
    });
    expect(repository.create).toHaveBeenCalledWith({ name: 'Korea' });
  });

  it('updates an unreferenced value and excludes it from duplicate checking', async () => {
    const { service, repository } = createService();
    await service.update(row.id, { name: 'Japan' }, manager);
    expect(repository.duplicate).toHaveBeenCalledWith(
      'Japan',
      undefined,
      row.id,
    );
    expect(repository.update).toHaveBeenCalledWith(row.id, { name: 'Japan' });
  });

  it('rejects normalized whitespace duplicates', async () => {
    const { service } = createService({
      duplicate: jest.fn().mockResolvedValue(true),
    });
    await expect(
      service.create({ name: ' korea ' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('deactivates, reactivates, and rejects same-state requests', async () => {
    const { service, repository } = createService();
    await service.deactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: false });
    await service.reactivate(row.id, manager);
    repository.find.mockResolvedValue({ ...row, isActive: true });
    await expect(service.reactivate(row.id, manager)).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
    });
  });

  it('applies the temporary referenced-identity safety guard', async () => {
    const { service } = createService({
      isReferenced: jest.fn().mockResolvedValue(true),
    });
    await expect(
      service.update(row.id, { name: 'Japan' }, manager),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('requires tenant-wide settings scope', async () => {
    const { service } = createService();
    await expect(
      service.create({ name: 'Korea' }, { tenantWide: false } as never),
    ).rejects.toMatchObject({ code: AppErrorCode.OutOfScope });
  });
});
