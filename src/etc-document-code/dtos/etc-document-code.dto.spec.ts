import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EtcDocumentCodeInputDto,
  EtcDocumentCodeQueryDto,
  UpdateEtcDocumentCodeDto,
} from './etc-document-code.dto';

describe('ETC Document Code DTOs', () => {
  it('trims and uppercases generic codes without numeric range validation', async () => {
    const input = plainToInstance(EtcDocumentCodeInputDto, {
      code: ' 1000 ',
      name: ' Custom ETC Code ',
    });

    expect(input.code).toBe('1000');
    expect(input.name).toBe('Custom ETC Code');
    await expect(validate(input)).resolves.toEqual([]);
  });

  it('rejects an invalid status and preserves the active default', async () => {
    const query = plainToInstance(EtcDocumentCodeQueryDto, {});
    expect(query.status).toBe('active');
    await expect(
      validate(plainToInstance(EtcDocumentCodeQueryDto, { status: 'unknown' })),
    ).resolves.not.toEqual([]);
  });

  it('does not accept lifecycle or ordering fields in updates', async () => {
    const update = plainToInstance(UpdateEtcDocumentCodeDto, {
      code: ' custom ',
      sortOrder: 10,
    });
    expect(update.code).toBe('CUSTOM');
    await expect(
      validate(update, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.not.toEqual([]);
  });
});
