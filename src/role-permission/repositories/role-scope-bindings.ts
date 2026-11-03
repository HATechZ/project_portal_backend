import { CustomRoleScope } from '../../generated/prisma/client';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';

export async function findAffectedScopeBindings(
  db: PrismaExecutor,
  tenantId: string,
  roleId: string,
  scope: CustomRoleScope,
) {
  const assignments = await db.userRole.findMany({
    where: { tenantId, roleId, revokedAt: null },
    select: { id: true, userId: true, teamId: true },
  });
  const profiles = await db.actorProfile.findMany({
    where: {
      tenantId,
      roleId,
      isActive: true,
      userId: { in: assignments.map(({ userId }) => userId) },
    },
    select: {
      id: true,
      userId: true,
      memberId: true,
      clientContactId: true,
      member: {
        select: {
          tenantId: true,
          userId: true,
          isActive: true,
          division: { select: { isActive: true } },
          company: { select: { isActive: true } },
        },
      },
      clientContact: {
        select: {
          tenantId: true,
          userId: true,
          isActive: true,
          client: { select: { isActive: true } },
        },
      },
    },
  });
  const affected: {
    id: string;
    userId: string | null;
    type: string;
    reason: string;
  }[] = [];
  const external =
    scope === CustomRoleScope.client ||
    scope === CustomRoleScope.client_contact;
  for (const assignment of assignments) {
    if (assignment.teamId)
      affected.push({
        id: assignment.id,
        userId: assignment.userId,
        type: 'userRole',
        reason: 'Legacy Team bindings are not supported by role assignment.',
      });
    if (!profiles.some((profile) => profile.userId === assignment.userId))
      affected.push({
        id: assignment.id,
        userId: assignment.userId,
        type: 'userRole',
        reason: 'An active ActorProfile is required for the assigned user.',
      });
  }
  for (const profile of profiles) {
    const member = profile.member;
    const contact = profile.clientContact;
    // Internal role-only profiles remain supported; resource checks still require
    // feature-owned Member/responsibility evidence where applicable.
    const valid = external
      ? !profile.memberId &&
        !!contact &&
        contact.tenantId === tenantId &&
        contact.userId === profile.userId &&
        contact.isActive &&
        contact.client.isActive
      : !profile.clientContactId &&
        (!profile.memberId ||
          (!!member &&
            member.tenantId === tenantId &&
            member.userId === profile.userId &&
            member.isActive &&
            member.division.isActive &&
            member.company.isActive));
    if (!valid)
      affected.push({
        id: profile.id,
        userId: profile.userId,
        type: 'actorProfile',
        reason:
          'The ActorProfile target is incompatible with the requested scope or is inactive.',
      });
  }
  return affected;
}
