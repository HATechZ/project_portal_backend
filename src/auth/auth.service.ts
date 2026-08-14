import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { LoginDto, RegisterDto } from './dtos';
import { AuthSessionProvider } from './providers';
import { SessionUser } from './repositories';

@Injectable()
export class AuthService {
  constructor(private readonly sessionProvider: AuthSessionProvider) {}

  login(request: Request, input: LoginDto): Promise<SessionUser> {
    return this.sessionProvider.login(request, input);
  }

  register(request: Request, input: RegisterDto): Promise<SessionUser> {
    return this.sessionProvider.register(request, input);
  }

  logout(request: Request): Promise<void> {
    return this.sessionProvider.logout(request);
  }

  currentUser(user: SessionUser): SessionUser {
    return user;
  }
}
