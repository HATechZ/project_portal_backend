import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDivisionDto } from './create-division.dto';
import { UpdateDivisionDto } from './update-division.dto';

describe('Division document-group configuration DTOs', () => {
  it('accepts distinct non-GENERAL configured groups', async () => {
    const errors = await validate(
      plainToInstance(CreateDivisionDto, {
        name: 'Engineering',
        abbr: 'ENG',
        documentGroups: ['ENGINEERING', 'CUSTOM'],
      }),
    );
    expect(errors).toEqual([]);
  });

  it.each([
    ['GENERAL is implicit', ['GENERAL']],
    ['duplicates are not allowed', ['ENGINEERING', 'ENGINEERING']],
    ['unknown values are rejected', ['NOT_A_GROUP']],
  ])('rejects %s', async (_, documentGroups) => {
    const errors = await validate(
      plainToInstance(UpdateDivisionDto, { documentGroups }),
    );
    expect(errors).not.toEqual([]);
  });
});
