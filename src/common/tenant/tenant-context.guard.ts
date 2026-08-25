import {
  BadRequestException,
  CanActivate,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from '../context/request-context';
import { TENANT_ID_HEADER } from './tenant.constants';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(): Promise<boolean> {
    const tenantId = RequestContext.tenantId();
    if (!tenantId) {
      throw new BadRequestException(`${TENANT_ID_HEADER} is required`);
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, isActive: true },
      select: { id: true },
    });
    if (!tenant) {
      throw new ForbiddenException('Tenant is not active');
    }
    return true;
  }
}
