import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserMutationProvider, UserQueryProvider } from './providers';
import { UserRepository } from './repositories';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserMutationProvider,
    UserQueryProvider,
    UserRepository,
  ],
  exports: [UserQueryProvider],
})
export class UserModule {}
