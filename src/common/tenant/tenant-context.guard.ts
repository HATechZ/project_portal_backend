import { BadRequestException, CanActivate, Injectable } from '@nestjs/common';
import { RequestContext } from '../context/request-context';
import { TENANT_ID_HEADER } from './tenant.constants';

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(): boolean {
    if (!RequestContext.tenantId()) {
      throw new BadRequestException(`${TENANT_ID_HEADER} is required`);
    }
    return true;
  }
}
