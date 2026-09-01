import {
  BadRequestException,
  CanActivate,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from '../context/request-context';
import { TENANT_ID_HEADER } from './tenant.constants';
import { TenantActivationService } from './tenant-activation.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenants: TenantActivationService) {}

  async canActivate(): Promise<boolean> {
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
