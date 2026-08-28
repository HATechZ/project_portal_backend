import { Prisma } from '../../generated/prisma/client';

/**
 * The authenticated principal, as the guards attach it to the request.
 *
 * This lives in the shared kernel rather than in `auth/repositories` because
 * every module's controller names it in a handler signature. Importing another
 * module's repository to spell a parameter type is still a boundary breach
 * (Art. XI) — a type import couples the build even when it costs nothing at
 * runtime.
 *
 * The selects travel with the types deliberately: they are one fact, and
 * splitting them lets the projection drift from the shape it produces.
 */
export const sessionUserSelect = (tenantId: string) =>
  ({
    id: true,
    fullName: true,
    email: true,
    avatarUrl: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    userRolesByUserId: {
      where: { revokedAt: null, tenantId },
      select: {
        role: {
          select: {
            code: true,
            workflowActionRolePermissionsByRoleId: {
              where: { allowed: true, tenantId },
              select: { action: { select: { code: true } } },
            },
          },
        },
      },
    },
  }) satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{
  select: ReturnType<typeof sessionUserSelect>;
}>;

export const sessionActorSelect = (tenantId: string) =>
  ({
    id: true,
    roleId: true,
    memberId: true,
    clientContactId: true,
    label: true,
    isDefault: true,
    role: {
      select: {
        code: true,
        workflowActionRolePermissionsByRoleId: {
          where: { tenantId, allowed: true },
          select: { action: { select: { code: true } } },
        },
      },
    },
    member: {
      select: {
        id: true,
        companyId: true,
        divisionId: true,
        isActive: true,
        company: {
          select: {
            id: true,
            isActive: true,
          },
        },
        division: {
          select: {
            id: true,
            companyId: true,
            isActive: true,
          },
        },
      },
    },
    clientContact: {
      select: {
        id: true,
        clientId: true,
        isActive: true,
        client: {
          select: {
            id: true,
            companyId: true,
            isActive: true,
            company: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        },
      },
    },
  }) satisfies Prisma.ActorProfileSelect;

export type SessionActor = Prisma.ActorProfileGetPayload<{
  select: ReturnType<typeof sessionActorSelect>;
}>;
