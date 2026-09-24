import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MarketingDocumentCodeInputDto,
  MarketingDocumentCodeQueryDto,
  UpdateMarketingDocumentCodeDto,
} from './marketing-document-code.dto';

describe('Marketing Document Code DTOs', () => {
  it('trims and uppercases code while retaining leading zeroes', async () => {
    const input = plainToInstance(MarketingDocumentCodeInputDto, {
      code: ' 001 ',
      name: ' Project Information ',
    });

    expect(input.code).toBe('001');
    expect(input.name).toBe('Project Information');
    await expect(validate(input)).resolves.toEqual([]);
  });

  it('rejects an invalid status and preserves the active default', async () => {
    const query = plainToInstance(MarketingDocumentCodeQueryDto, {});
    expect(query.status).toBe('active');
    await expect(
      validate(
        plainToInstance(MarketingDocumentCodeQueryDto, { status: 'unknown' }),
      ),
    ).resolves.not.toEqual([]);
  });

  it('does not expose lifecycle or ordering fields in update validation', async () => {
    const update = plainToInstance(UpdateMarketingDocumentCodeDto, {
      code: ' abc ',
      sortOrder: 10,
    });
    expect(update.code).toBe('ABC');
    await expect(
      validate(update, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.not.toEqual([]);
  });
});
