import { ValidationPipe } from '@nestjs/common';
import { CreateMemberDto } from './create-member.dto';

describe('CreateMemberDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const input = {
    name: 'Jane Member',
    email: 'jane@example.com',
    password: 'secret123',
    divisionId: '00000000-0000-4000-8000-000000000001',
  };

  it('accepts Member onboarding without a role', async () => {
    await expect(
      pipe.transform(input, { type: 'body', metatype: CreateMemberDto }),
    ).resolves.toBeInstanceOf(CreateMemberDto);
  });

  it('rejects roleId rather than silently accepting it', async () => {
    await expect(
      pipe.transform(
        { ...input, roleId: '00000000-0000-4000-8000-000000000002' },
        { type: 'body', metatype: CreateMemberDto },
      ),
    ).rejects.toThrow();
  });
});
