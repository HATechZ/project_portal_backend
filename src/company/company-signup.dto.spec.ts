import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanySignupDto } from './dtos';

const valid = () => ({
  company: {
    name: ' Tech Marine Solutions Ltd ',
    abbr: ' TMS ',
    companyTypeId: '20000000-0000-4000-8000-000000000001',
  },
  admin: {
    fullName: ' Nayeem Rahman ',
    email: ' NAYEEM@TECHMARINE.COM ',
    password: 'SecurePassword123',
    country: ' Bangladesh ',
    phone: ' +880 1711-234567 ',
  },
  termsAccepted: true,
});

async function errors(payload: object) {
  return validate(plainToInstance(CompanySignupDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CompanySignupDto', () => {
  it('accepts and normalizes the product contract', async () => {
    const dto = plainToInstance(CompanySignupDto, valid());
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.company.name).toBe('Tech Marine Solutions Ltd');
    expect(dto.admin.email).toBe('nayeem@techmarine.com');
    expect(dto.admin.country).toBe('Bangladesh');
  });

  it.each(['fullName', 'country', 'phone'])(
    'requires non-empty admin.%s',
    async (field) => {
      const payload = valid();
      payload.admin[field as 'fullName'] = '   ';
      expect(await errors(payload)).not.toHaveLength(0);
    },
  );

  it('requires an existing-shape CompanyType UUID and accepted terms', async () => {
    const payload = valid();
    payload.company.companyTypeId = 'EPC Contractor';
    payload.termsAccepted = false;
    expect(await errors(payload)).not.toHaveLength(0);
  });

  it.each([
    ['tenantId', 'tenant-id'],
    ['roleId', 'role-id'],
    ['permissions', []],
    ['memberId', 'member-id'],
    ['clientContactId', 'contact-id'],
    ['confirmPassword', 'SecurePassword123'],
  ])('rejects undeclared admin field %s', async (field, value) => {
    const payload = valid() as ReturnType<typeof valid> & {
      admin: Record<string, unknown>;
    };
    payload.admin[field] = value;
    expect(await errors(payload)).not.toHaveLength(0);
  });
});
