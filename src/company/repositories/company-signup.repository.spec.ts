import { CompanySignupRepository } from './company-signup.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

describe('CompanySignupRepository', () => {
  const db = { $queryRaw: jest.fn() };
  const unitOfWork = {
    executeProvisioning: jest.fn((work: (client: typeof db) => unknown) =>
      work(db),
    ),
  };
  const input = {
    companyName: 'Tech Marine Solutions Ltd',
    companyAbbr: 'TMS',
    companyTypeId: '20000000-0000-4000-8000-000000000001',
    adminFullName: 'Nayeem Rahman',
    adminEmail: 'nayeem@techmarine.com',
    adminPasswordHash: 'bcrypt-hash',
    adminCountry: 'Bangladesh',
    adminPhone: '+880 1711-234567',
  };

  beforeEach(() => jest.clearAllMocks());

  it('uses one database function call as the atomic boundary', async () => {
    db.$queryRaw.mockResolvedValue([
      { company_id: 'company-id', user_id: 'user-id' },
    ]);
    const repository = new CompanySignupRepository(
      unitOfWork as unknown as UnitOfWorkService,
    );

    await expect(repository.provision(input)).resolves.toEqual({
      companyId: 'company-id',
      userId: 'user-id',
    });
    expect(unitOfWork.executeProvisioning).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates a function failure without attempting another write', async () => {
    db.$queryRaw.mockRejectedValue(new Error('permission bootstrap failed'));
    const repository = new CompanySignupRepository(
      unitOfWork as unknown as UnitOfWorkService,
    );

    await expect(repository.provision(input)).rejects.toThrow(
      'permission bootstrap failed',
    );
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
