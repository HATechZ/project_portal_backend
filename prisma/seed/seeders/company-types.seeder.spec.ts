import { companyTypesSeeder } from './company-types.seeder';
import { SeedContext } from '../types';

describe('companyTypesSeeder', () => {
  it('is repeatable through the deterministic CompanyType id', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const context = { prisma: { companyType: { upsert } } } as SeedContext;

    await companyTypesSeeder.run(context);
    await companyTypesSeeder.run(context);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: '20000000-0000-4000-8000-000000000001' },
        update: expect.objectContaining({ name: 'EPC Contractor' }),
      }),
    );
  });
});
