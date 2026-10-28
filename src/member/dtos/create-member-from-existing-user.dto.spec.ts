import { ValidationPipe } from '@nestjs/common';
import { CreateMemberFromExistingUserDto } from './create-member-from-existing-user.dto';

describe('CreateMemberFromExistingUserDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const input = {
    userId: '00000000-0000-4000-8000-000000000001',
    actorProfileId: '00000000-0000-4000-8000-000000000002',
    divisionId: '00000000-0000-4000-8000-000000000003',
    designationId: '00000000-0000-4000-8000-000000000004',
  };

  it('accepts explicit existing-User Member onboarding fields only', async () => {
    await expect(
      pipe.transform(input, {
        type: 'body',
        metatype: CreateMemberFromExistingUserDto,
      }),
    ).resolves.toBeInstanceOf(CreateMemberFromExistingUserDto);
  });

  it.each([
    'password',
    'email',
    'name',
    'tenantId',
    'companyId',
    'memberId',
    'roleId',
  ])('rejects forbidden %s input', async (forbidden) => {
    await expect(
      pipe.transform(
        { ...input, [forbidden]: '00000000-0000-4000-8000-000000000005' },
        { type: 'body', metatype: CreateMemberFromExistingUserDto },
      ),
    ).rejects.toThrow();
  });
});
