import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateDivisionDto, UpdateDivisionDto } from './index';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: false },
});

function metadata<T>(metatype: new () => T): ArgumentMetadata {
  return { type: 'body', metatype };
}

describe('Division DTO validation', () => {
  it('accepts and trims the create allow-list only', async () => {
    const result = (await pipe.transform(
      {
        name: ' Engineering ',
        abbr: ' ENG ',
        divisionTypeId: '33333333-3333-4333-8333-333333333333',
      },
      metadata(CreateDivisionDto),
    )) as CreateDivisionDto;

    expect(result).toEqual({
      name: 'Engineering',
      abbr: 'ENG',
      divisionTypeId: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('treats blank optional divisionTypeId as omitted on create', async () => {
    const result = (await pipe.transform(
      {
        name: 'Engineering',
        abbr: 'ENG',
        divisionTypeId: '',
      },
      metadata(CreateDivisionDto),
    )) as CreateDivisionDto;

    expect(result).toEqual({
      name: 'Engineering',
      abbr: 'ENG',
      divisionTypeId: undefined,
    });
  });

  it.each([
    ['tenantId'],
    ['companyId'],
    ['isActive'],
    ['leadMemberId'],
    ['userId'],
    ['memberId'],
    ['teamId'],
  ])('rejects client-controlled create field %s', async (field) => {
    await expect(
      pipe.transform(
        {
          name: 'Engineering',
          abbr: 'ENG',
          [field]: '33333333-3333-4333-8333-333333333333',
        },
        metadata(CreateDivisionDto),
      ),
    ).rejects.toThrow();
  });

  it.each([
    [{ name: '' }],
    [{ name: ' ' }],
    [{ name: 'x'.repeat(181) }],
    [{ abbr: '' }],
    [{ abbr: ' ' }],
    [{ abbr: 'x'.repeat(31) }],
    [{ divisionTypeId: null }],
    [{ divisionTypeId: 'not-a-uuid' }],
  ])('rejects invalid create values %#', async (body) => {
    await expect(
      pipe.transform(
        { name: 'Engineering', abbr: 'ENG', ...body },
        metadata(CreateDivisionDto),
      ),
    ).rejects.toThrow();
  });

  it('accepts partial update fields and trims strings', async () => {
    const result = (await pipe.transform(
      { name: ' Operations ', abbr: ' OPS ' },
      metadata(UpdateDivisionDto),
    )) as UpdateDivisionDto;

    expect(result).toEqual({ name: 'Operations', abbr: 'OPS' });
  });

  it.each([['tenantId'], ['companyId'], ['isActive'], ['createdAt']])(
    'rejects immutable update field %s',
    async (field) => {
      await expect(
        pipe.transform({ [field]: 'blocked' }, metadata(UpdateDivisionDto)),
      ).rejects.toThrow();
    },
  );

  it.each([[{ name: null }], [{ abbr: null }], [{ divisionTypeId: null }]])(
    'rejects null update values %#',
    async (body) => {
      await expect(
        pipe.transform(body, metadata(UpdateDivisionDto)),
      ).rejects.toThrow();
    },
  );
});
