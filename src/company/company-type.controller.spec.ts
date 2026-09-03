import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CompanyTypeController } from './company-type.controller';
import { CompanyService } from './company.service';

describe('CompanyTypeController', () => {
  it('exposes signup reference data without tenant or authentication guards', async () => {
    const companyTypes = [
      {
        id: '20000000-0000-4000-8000-000000000001',
        name: 'EPC Contractor',
        description: null,
      },
    ];
    const service = {
      findCompanyTypes: jest.fn().mockResolvedValue(companyTypes),
    };
    const controller = new CompanyTypeController(
      service as unknown as CompanyService,
    );

    await expect(controller.findAll()).resolves.toEqual(companyTypes);
    expect(Reflect.getMetadata(PATH_METADATA, CompanyTypeController)).toBe('/');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CompanyTypeController),
    ).toBeUndefined();
  });
});
