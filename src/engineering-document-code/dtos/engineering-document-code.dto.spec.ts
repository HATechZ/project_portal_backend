import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EngineeringDocumentCodeInputDto,
  EngineeringDocumentCodeQueryDto,
  UpdateEngineeringDocumentCodeDto,
} from './engineering-document-code.dto';

describe('Engineering Document Code DTOs', () => {
  it('normalizes generic codes outside the historical range', async () => {
    const input = plainToInstance(EngineeringDocumentCodeInputDto, {
      code: ' 700 ',
      name: ' Custom Engineering Code ',
    });
    expect(input.code).toBe('700');
    expect(input.name).toBe('Custom Engineering Code');
    await expect(validate(input)).resolves.toEqual([]);
  });
  it('defaults status and rejects invalid status', async () => {
    expect(plainToInstance(EngineeringDocumentCodeQueryDto, {}).status).toBe(
      'active',
    );
    await expect(
      validate(
        plainToInstance(EngineeringDocumentCodeQueryDto, { status: 'unknown' }),
      ),
    ).resolves.not.toEqual([]);
  });
  it('does not accept lifecycle or ordering fields on update', async () => {
    const update = plainToInstance(UpdateEngineeringDocumentCodeDto, {
      code: 'abc',
      sortOrder: 1,
    });
    await expect(
      validate(update, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.not.toEqual([]);
  });
});
