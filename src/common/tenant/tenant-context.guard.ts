import {
  BadRequestException,
  CanActivate,
  ForbiddenException,
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AccessTokenRequest } from '../security/access-token.guard';
import { RequestContext } from '../context/request-context';
import { TENANT_ID_HEADER } from './tenant.constants';
import { TenantActivationService } from './tenant-activation.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenants: TenantActivationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessTokenRequest>();
    if (!request.accessTokenPayload) {
      const value = request.headers[TENANT_ID_HEADER];
      if (value === undefined) {
        throw new BadRequestException(`${TENANT_ID_HEADER} is required`);
      }
      if (typeof value !== 'string' || !isUUID(value)) {
        throw new BadRequestException(
          `${TENANT_ID_HEADER} must be a valid UUID`,
        );
      }
      RequestContext.setTenantId(value);
      request.tenantId = value;
    }
    const tenantId = RequestContext.tenantId();
    if (!tenantId) {
      throw new BadRequestException(`${TENANT_ID_HEADER} is required`);
    }

    if (!(await this.tenants.isActive(tenantId))) {
      throw new ForbiddenException('Tenant is not active');
    }
    return true;
  }
}
