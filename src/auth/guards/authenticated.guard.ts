import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthSessionProvider } from '../providers';
import { SessionUser } from '../repositories';

type AuthenticatedRequest = Request & { user?: SessionUser };

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly sessionProvider: AuthSessionProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');

    const user = await this.sessionProvider.findActiveUser(userId);
    if (!user) throw new UnauthorizedException('Authentication required');
    request.user = user;
    return true;
  }
}
