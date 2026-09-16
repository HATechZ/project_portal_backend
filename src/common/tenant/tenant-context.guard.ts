import { CanActivate, Injectable, ExecutionContext } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AccessTokenRequest } from '../security/access-token.guard';
import { RequestContext } from '../context/request-context';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
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
        throw invalidTenant();
      }
      if (typeof value !== 'string' || !isUUID(value)) {
        throw invalidTenant();
      }
      RequestContext.setTenantId(value);
      request.tenantId = value;
    }
    const tenantId = RequestContext.tenantId();
    if (!tenantId) {
      throw invalidTenant();
    }

    if (!(await this.tenants.isActive(tenantId))) {
      throw new AppException({
        code: AppErrorCode.TenantInactive,
        status: 403,
        message:
          'This workspace is inactive. Contact your administrator for assistance.',
      });
    }
    return true;
  }
}

function invalidTenant(): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: 400,
    message: 'The selected value is invalid.',
  });
}
