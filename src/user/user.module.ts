import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserCreateProvider } from './providers';
import { UserRepository } from './repositories';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, UserCreateProvider, UserRepository],
})
export class UserModule {}
