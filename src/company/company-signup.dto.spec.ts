import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanySignupDto } from './dtos';
import { ValidationPipe } from '@nestjs/common';

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
    confirmPassword: 'SecurePassword123',
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

  it('rejects a caller-supplied workspaceSlug', async () => {
    const payload = valid() as ReturnType<typeof valid> & {
      company: Record<string, unknown>;
    };
    payload.company.workspaceSlug = 'caller-controlled';
    expect(await errors(payload)).not.toHaveLength(0);
  });

  it.each([
    ['tenantId', 'tenant-id'],
    ['roleId', 'role-id'],
    ['permissions', []],
    ['memberId', 'member-id'],
    ['clientContactId', 'contact-id'],
  ])('rejects undeclared admin field %s', async (field, value) => {
    const payload = valid() as ReturnType<typeof valid> & {
      admin: Record<string, unknown>;
    };
    payload.admin[field] = value;
    expect(await errors(payload)).not.toHaveLength(0);
  });

  it.each([
    ['mismatch', 'DifferentPassword123'],
    ['missing', undefined],
    ['null', null],
  ])(
    'returns 400 for %s confirmation before signup logic',
    async (_case, confirmation) => {
      const payload = {
        ...valid(),
        admin: { ...valid().admin, confirmPassword: confirmation },
      };
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      const signup = jest.fn();
      await expect(
        pipe
          .transform(payload, { type: 'body', metatype: CompanySignupDto })
          .then(signup),
      ).rejects.toMatchObject({ status: 400 });
      expect(signup).not.toHaveBeenCalled();
    },
  );

  it.each(['short', 'x'.repeat(73), 'é'.repeat(37)])(
    'preserves password byte-length rules',
    async (password) => {
      const payload = valid();
      payload.admin.password = password;
      payload.admin.confirmPassword = password;
      expect(await errors(payload)).not.toHaveLength(0);
    },
  );

  it('compares passwords exactly without trimming', async () => {
    const payload = valid();
    payload.admin.confirmPassword += ' ';
    expect(await errors(payload)).not.toHaveLength(0);
  });
});
