import { Request } from 'express';
import { AuthUser } from '../auth-user.type';

export class LoginCommand {
  constructor(
    readonly request: Request,
    readonly user: AuthUser,
  ) {}
}
