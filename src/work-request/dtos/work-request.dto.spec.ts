import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorkRequestDto, UpdateWorkRequestDto } from './work-request.dto';

const bidId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';

async function createErrors(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateWorkRequestDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

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

describe('CreateWorkRequestDto parent normalization', () => {
  it('treats a blank bid ID as absent when a Project ID is supplied', async () => {
    const dto = plainToInstance(CreateWorkRequestDto, {
      bidId: '   ',
      projectId,
      title: 'Request',
      priority: 'High',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.bidId).toBeUndefined();
    expect(dto.projectId).toBe(projectId);
  });

  it('treats a blank Project ID as absent when a Bid ID is supplied', async () => {
    const dto = plainToInstance(CreateWorkRequestDto, {
      bidId,
      projectId: '',
      title: 'Request',
      priority: 'High',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.bidId).toBe(bidId);
    expect(dto.projectId).toBeUndefined();
  });

  it('normalizes both blank parent IDs to absent values for the XOR rule', async () => {
    const dto = plainToInstance(CreateWorkRequestDto, {
      bidId: '',
      projectId: '  ',
      title: 'Request',
      priority: 'High',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.bidId).toBeUndefined();
    expect(dto.projectId).toBeUndefined();
  });

  it.each([
    ['bidId', 'not-a-uuid'],
    ['projectId', 'not-a-uuid'],
  ])('rejects a non-empty malformed %s', async (field, value) => {
    const errors = await createErrors({
      [field]: value,
      title: 'Request',
      priority: 'High',
    });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: field })]),
    );
  });

  it('does not turn a blank document code array item into an optional value', async () => {
    const errors = await createErrors({
      bidId,
      title: 'Request',
      priority: 'High',
      documentCodeIds: [''],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'documentCodeIds' }),
      ]),
    );
  });
});
