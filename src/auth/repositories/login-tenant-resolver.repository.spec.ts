import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { LoginTenantResolverRepository } from './login-tenant-resolver.repository';

describe('LoginTenantResolverRepository', () => {
  const db = { $queryRaw: jest.fn() };
  const unitOfWork = {
    executeLoginResolution: jest.fn((work: (executor: typeof db) => unknown) =>
      work(db),
    ),
  };

  beforeEach(() => jest.clearAllMocks());

  it('uses only the narrow email login resolver function', async () => {
    db.$queryRaw.mockResolvedValue([{ tenant_id: 'tenant-a' }]);
    const repository = new LoginTenantResolverRepository(
      unitOfWork as unknown as UnitOfWorkService,
    );

    await expect(repository.resolve('user@example.com')).resolves.toEqual({
      tenantId: 'tenant-a',
    });
    expect(unitOfWork.executeLoginResolution).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns no public detail for an unknown email', async () => {
    db.$queryRaw.mockResolvedValue([]);
    const repository = new LoginTenantResolverRepository(
      unitOfWork as unknown as UnitOfWorkService,
    );
    await expect(repository.resolve('missing@example.com')).resolves.toBeNull();
  });
});
