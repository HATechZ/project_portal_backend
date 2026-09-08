import { ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto edge validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: false },
  });
  const validate = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: UpdateUserDto });
  it.each(['fullName', 'email', 'password', 'isActive'])(
    'rejects null %s before mutation',
    async (field) => {
      const mutate = jest.fn();
      await expect(
        validate({ [field]: null }).then(mutate),
      ).rejects.toMatchObject({ status: 400 });
      expect(mutate).not.toHaveBeenCalled();
    },
  );
  it('accepts omitted fields and explicitly nullable avatar', async () => {
    await expect(validate({ avatarUrl: null })).resolves.toEqual({
      avatarUrl: null,
    });
    await expect(validate({ isActive: false })).resolves.toEqual({
      isActive: false,
    });
  });
  it('rejects strings for booleans and unknown fields', async () => {
    await expect(validate({ isActive: 'false' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(validate({ passwordHash: 'secret' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
