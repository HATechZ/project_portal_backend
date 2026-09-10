import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';

export interface EnsuredRoleProfile {
  assignmentId: string;
  actorProfileId: string;
}

export async function ensureUserRoleAndRoleOnlyProfile(
  db: PrismaExecutor,
  input: {
    tenantId: string;
    userId: string;
    roleId: string;
    assignedByUserId: string;
    memberId?: string;
  },
): Promise<EnsuredRoleProfile> {
  await db.$queryRaw`SELECT id FROM users WHERE id = ${input.userId}::uuid AND tenant_id = ${input.tenantId}::uuid FOR UPDATE`;
  await db.user.findUniqueOrThrow({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { id: true },
  });
  const role = await db.role.findUniqueOrThrow({
    where: { id: input.roleId },
    select: { name: true },
  });
  const existing = await db.userRole.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      revokedAt: null,
    },
    select: { id: true },
  });
  const assignment =
    existing ??
    (await db.userRole.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        userId: input.userId,
        roleId: input.roleId,
        assignedByUserId: input.assignedByUserId,
      },
      select: { id: true },
    }));

  const validDefault = await db.actorProfile.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      isDefault: true,
      isActive: true,
      role: {
        userRolesByRoleId: {
          some: {
            tenantId: input.tenantId,
            userId: input.userId,
            revokedAt: null,
          },
        },
      },
    },
    select: { id: true },
  });
  const profile = await db.actorProfile.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      ...(input.memberId
        ? { OR: [{ memberId: null }, { memberId: input.memberId }] }
        : { memberId: null }),
      clientContactId: null,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!validDefault) {
    await db.actorProfile.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }
  const actorProfileId = profile
    ? profile.id
    : (
        await db.actorProfile.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            userId: input.userId,
            roleId: input.roleId,
            label: role.name,
            ...(input.memberId ? { memberId: input.memberId } : {}),
            isActive: true,
            isDefault: !validDefault,
          },
          select: { id: true },
        })
      ).id;
  if (profile) {
    await db.actorProfile.update({
      where: { id: profile.id, tenantId: input.tenantId },
      data: {
        isActive: true,
        ...(!validDefault ? { isDefault: true } : {}),
      },
    });
  }
  return { assignmentId: assignment.id, actorProfileId };
}

export async function linkMemberUserActorProfile(
  db: PrismaExecutor,
  input: {
    tenantId: string;
    companyId: string;
    memberId: string;
    userId: string;
    actorProfileId: string;
  },
): Promise<void> {
  const member = await db.member.findFirst({
    where: {
      id: input.memberId,
      tenantId: input.tenantId,
      companyId: input.companyId,
    },
    select: { id: true, userId: true },
  });
  if (!member) throw accessNotFound('Member was not found');
  if (member.userId && member.userId !== input.userId) {
    throw accessConflict('Member is already linked to a different User');
  }

  const user = await db.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!user) throw accessNotFound('User was not found');

  const actorProfile = await db.actorProfile.findFirst({
    where: { id: input.actorProfileId, tenantId: input.tenantId },
    select: {
      id: true,
      userId: true,
      roleId: true,
      memberId: true,
      isActive: true,
    },
  });
  if (!actorProfile) throw accessNotFound('ActorProfile was not found');
  if (!actorProfile.isActive || actorProfile.userId !== input.userId) {
    throw accessConflict('ActorProfile is not eligible for this User');
  }
  if (actorProfile.memberId && actorProfile.memberId !== input.memberId) {
    throw accessConflict('ActorProfile is linked to a different Member');
  }

  const activeGrant = await db.userRole.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      roleId: actorProfile.roleId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!activeGrant) {
    throw accessConflict('ActorProfile has no active matching UserRole');
  }

  await db.member.update({
    where: { id_tenantId: { id: member.id, tenantId: input.tenantId } },
    data: { userId: input.userId, updatedAt: new Date() },
  });
  await db.actorProfile.update({
    where: { id: input.actorProfileId },
    data: { memberId: member.id },
  });
}

function accessNotFound(message: string): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}

function accessConflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
