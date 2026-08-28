import { Global, Module } from '@nestjs/common';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { PASSWORD_HASHER } from './password-hasher.port';

@Global()
@Module({
  providers: [
    BcryptPasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: BcryptPasswordHasher },
  ],
  exports: [PASSWORD_HASHER],
})
export class CryptoModule {}
