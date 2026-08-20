import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { LoginDto } from './dtos';
import { AuthSessionProvider } from './providers';
import { SessionUser } from './repositories';

@Injectable()
export class AuthService {
  constructor(private readonly sessionProvider: AuthSessionProvider) {}

  login(request: Request, input: LoginDto): Promise<SessionUser> {
    return this.sessionProvider.login(request, input);
  }

  logout(request: Request): Promise<void> {
    return this.sessionProvider.logout(request);
  }

  currentUser(user: SessionUser): SessionUser {
    return user;
  }
}
