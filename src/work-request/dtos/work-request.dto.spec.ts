import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateWorkRequestDto } from './work-request.dto';

describe('UpdateWorkRequestDto', () => {
  it('rejects priority because Work Request priority is immutable after creation', async () => {
    const dto = plainToInstance(UpdateWorkRequestDto, {
      priority: 'High',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'priority' }),
      ]),
    );
  });
});
