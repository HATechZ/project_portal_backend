import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { establishPortalAccess } from './client-onboarding.repository';
import { PortalAccessRecord } from './client.records';

@Injectable()
export class ClientAccessRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  grant(clientId: string, contactId: string, companyId: string, assignedByUserId: string): Promise<PortalAccessRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const client = await db.client.findFirst({
        where: { id: clientId, tenantId, companyId, isActive: true }, select: { id: true, name: true },
      });
      if (!client) throw this.notFound('Client was not found');
      const contact = await db.clientContact.findFirst({
        where: { id: contactId, tenantId, clientId, isActive: true },
        select: { id: true, name: true, email: true, userId: true },
      });
      if (!contact) throw this.notFound('Client contact was not found');
      return establishPortalAccess(db, client, contact, assignedByUserId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  revoke(clientId: string, contactId: string, companyId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const contact = await db.clientContact.findFirst({
        where: { id: contactId, tenantId, clientId, client: { companyId } }, select: { userId: true },
      });
      if (!contact) throw this.notFound('Client contact was not found');
      if (!contact.userId) return;
      const role = await db.role.findUnique({ where: { code: ActorRoleCode.client_owner }, select: { id: true } });
      if (!role) throw this.notFound('Client owner role was not found');
      await db.actorProfile.updateMany({
        where: { tenantId, userId: contact.userId, roleId: role.id, clientContactId: contactId, isActive: true },
        data: { isActive: false },
      });
      const otherActiveProfile = await db.actorProfile.findFirst({
        where: { tenantId, userId: contact.userId, roleId: role.id, isActive: true }, select: { id: true },
      });
      if (!otherActiveProfile) {
        await db.userRole.updateMany({
          where: { tenantId, userId: contact.userId, roleId: role.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  private notFound(message: string): AppException {
    return new AppException({ code: AppErrorCode.NotFound, status: HttpStatus.NOT_FOUND, message });
  }
}
