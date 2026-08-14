import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AuthUser } from '../auth-user.type';
import { GetCurrentUserQuery } from '../queries/get-current-user.query';

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<
  GetCurrentUserQuery,
  AuthUser
> {
  async execute({ user }: GetCurrentUserQuery): Promise<AuthUser> {
    return Promise.resolve(user);
  }
}
