import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ActorRoleCode } from '../../generated/prisma/client';
import { SessionActor } from '../repositories';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const actor = context
      .switchToHttp()
      .getRequest<{ actor?: SessionActor }>().actor;
    const isSystemAdmin = actor?.role.code === ActorRoleCode.system_admin;

    if (!isSystemAdmin) {
      throw new ForbiddenException('System administrator access required');
    }
    return true;
  }
}
