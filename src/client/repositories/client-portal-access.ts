import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ActorRoleCode } from '../../generated/prisma/client';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import {
  ClientContactRecord,
  ClientRecord,
  clientContactSelect,
  PortalAccessRecord,
} from './client.records';

/**
 * Links a Client contact to a User with the client_owner role and profile. Runs inside the
 * caller's transaction so onboarding and a later portal grant share one code path.
 */
export async function establishPortalAccess(
  db: PrismaExecutor,
  client: Pick<ClientRecord, 'id' | 'name'>,
  contact: Pick<ClientContactRecord, 'id' | 'name' | 'email' | 'userId'>,
  assignedByUserId: string,
): Promise<PortalAccessRecord> {
  const tenantId = RequestContext.requireTenantId();
  let user = contact.userId
    ? await db.user.findFirst({
        where: { id: contact.userId, tenantId },
        select: { id: true, email: true, passwordHash: true },
      })
    : await db.user.findFirst({
        where: { tenantId, email: normalizeEmail(contact.email) },
        select: { id: true, email: true, passwordHash: true },
      });
  let created = false;
  if (!user) {
    user = await db.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        fullName: contact.name.trim(),
        email: normalizeEmail(contact.email),
        isActive: true,
      },
      select: { id: true, email: true, passwordHash: true },
    });
    created = true;
  }

  await db.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
  const role = await db.role.findUnique({
    where: { code: ActorRoleCode.client_owner },
    select: { id: true, name: true },
  });
  if (!role) throw conflict('Client owner role is unavailable');
  const activeRole = await db.userRole.findFirst({
    where: { tenantId, userId: user.id, roleId: role.id, revokedAt: null },
    select: { id: true },
  });
  if (!activeRole) {
    await db.userRole.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId: user.id,
        roleId: role.id,
        assignedByUserId,
      },
    });
  }

  const profile = await db.actorProfile.findFirst({
    where: {
      tenantId,
      userId: user.id,
      roleId: role.id,
      clientContactId: contact.id,
    },
    select: { id: true, isDefault: true },
  });
  const hasDefault = await db.actorProfile.findFirst({
    where: { tenantId, userId: user.id, isActive: true, isDefault: true },
    select: { id: true },
  });
  if (!hasDefault) {
    await db.actorProfile.updateMany({
      where: { tenantId, userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  if (profile) {
    await db.actorProfile.update({
      where: { id_tenantId: { id: profile.id, tenantId } },
      data: { isActive: true, ...(!hasDefault ? { isDefault: true } : {}) },
    });
  } else {
    await db.actorProfile.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId: user.id,
        roleId: role.id,
        clientContactId: contact.id,
        label: role.name,
        isActive: true,
        isDefault: !hasDefault,
      },
    });
  }
  const linked = await db.clientContact.update({
    where: { id_tenantId: { id: contact.id, tenantId } },
    data: { userId: user.id, updatedAt: new Date() },
    select: clientContactSelect,
  });
  return {
    client,
    clientContact: linked,
    setupRequired: created || user.passwordHash === null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function conflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
