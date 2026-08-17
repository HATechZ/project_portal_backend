import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ActorRoleCode } from '../../generated/prisma/client';
import { SessionUser } from '../repositories';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: SessionUser }>().user;
    const isSystemAdmin = user?.userRolesByUserId.some(
      ({ role }) => role.code === ActorRoleCode.system_admin,
    );

    if (!isSystemAdmin) {
      throw new ForbiddenException('System administrator access required');
    }
    return true;
  }
}
