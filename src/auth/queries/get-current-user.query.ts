import { AuthUser } from '../auth-user.type';

export class GetCurrentUserQuery {
  constructor(readonly user: AuthUser) {}
}
