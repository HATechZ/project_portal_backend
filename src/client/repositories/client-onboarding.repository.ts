import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ClientContactInput } from './client-contact.repository';
import { ClientContactRecord, ClientRecord, clientContactSelect, clientSelect, PortalAccessRecord } from './client.records';

export interface ClientOnboardingInput {
  name: string;
  primaryContact: ClientContactInput;
  enablePortalAccess: boolean;
  assignedByUserId: string;
}

export interface ClientOnboardingRecord {
  client: ClientRecord;
  contact: ClientContactRecord;
  setupRequired: boolean;
}

@Injectable()
export class ClientOnboardingRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  create(companyId: string, input: ClientOnboardingInput): Promise<ClientOnboardingRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const client = await db.client.create({
        data: { id: randomUUID(), tenantId, companyId, name: input.name.trim(), isActive: true },
        select: clientSelect,
      });
      const contact = await db.clientContact.create({
        data: {
          id: randomUUID(), tenantId, clientId: client.id,
          name: input.primaryContact.name.trim(),
          email: normalizeEmail(input.primaryContact.email),
          designation: optional(input.primaryContact.designation),
          phone: optional(input.primaryContact.phone), isActive: true, isPrimary: true,
        },
        select: clientContactSelect,
      });
      if (!input.enablePortalAccess) return { client, contact, setupRequired: false };
      const portal = await establishPortalAccess(db, client, contact, input.assignedByUserId);
      return { client, contact: portal.clientContact as ClientContactRecord, setupRequired: portal.setupRequired };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

}

export async function establishPortalAccess(
  db: PrismaExecutor,
  client: Pick<ClientRecord, 'id' | 'name'>,
  contact: Pick<ClientContactRecord, 'id' | 'name' | 'email' | 'userId'>,
  assignedByUserId: string,
): Promise<PortalAccessRecord> {
    const tenantId = RequestContext.requireTenantId();
    let user = contact.userId
      ? await db.user.findFirst({ where: { id: contact.userId, tenantId }, select: { id: true, email: true, passwordHash: true } })
      : await db.user.findFirst({ where: { tenantId, email: normalizeEmail(contact.email) }, select: { id: true, email: true, passwordHash: true } });
    let created = false;
    if (!user) {
      user = await db.user.create({
        data: { id: randomUUID(), tenantId, fullName: contact.name.trim(), email: normalizeEmail(contact.email), isActive: true },
        select: { id: true, email: true, passwordHash: true },
      });
      created = true;
    }

    await db.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
    const role = await db.role.findUnique({ where: { code: ActorRoleCode.client_owner }, select: { id: true, name: true } });
    if (!role) throw conflict('Client owner role is unavailable');
    const activeRole = await db.userRole.findFirst({
      where: { tenantId, userId: user.id, roleId: role.id, revokedAt: null }, select: { id: true },
    });
    if (!activeRole) {
      await db.userRole.create({
        data: { id: randomUUID(), tenantId, userId: user.id, roleId: role.id, assignedByUserId },
      });
    }

    const profile = await db.actorProfile.findFirst({
      where: { tenantId, userId: user.id, roleId: role.id, clientContactId: contact.id },
      select: { id: true, isDefault: true },
    });
    const hasDefault = await db.actorProfile.findFirst({
      where: { tenantId, userId: user.id, isActive: true, isDefault: true }, select: { id: true },
    });
    if (!hasDefault) {
      await db.actorProfile.updateMany({ where: { tenantId, userId: user.id, isDefault: true }, data: { isDefault: false } });
    }
    if (profile) {
      await db.actorProfile.update({
        where: { id_tenantId: { id: profile.id, tenantId } },
        data: { isActive: true, ...(!hasDefault ? { isDefault: true } : {}) },
      });
    } else {
      await db.actorProfile.create({
        data: {
          id: randomUUID(), tenantId, userId: user.id, roleId: role.id, clientContactId: contact.id,
          label: role.name, isActive: true, isDefault: !hasDefault,
        },
      });
    }
    const linked = await db.clientContact.update({
      where: { id_tenantId: { id: contact.id, tenantId } },
      data: { userId: user.id, updatedAt: new Date() }, select: clientContactSelect,
    });
    return {
      client,
      clientContact: linked,
      setupRequired: created || user.passwordHash === null,
    };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function optional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function conflict(message: string): AppException {
  return new AppException({ code: AppErrorCode.Conflict, status: HttpStatus.CONFLICT, message });
}
