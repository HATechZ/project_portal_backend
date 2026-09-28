import { Prisma } from '../../generated/prisma/client';

export const workRequestInfoSelect = {
  id: true,
  bid: { select: { clientId: true, client: { select: { companyId: true } } } },
  directProject: {
    select: { clientId: true, client: { select: { companyId: true } } },
  },
  events: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
    select: { resultingState: true },
  },
  assignments: {
    where: { unassignedAt: null, replacedAt: null },
    select: { level: true, divisionId: true, teamId: true },
  },
} satisfies Prisma.WorkRequestV1Select;

export const workRequestInfoTargetSelect = (tenantId: string) =>
  ({
    id: true,
    roleId: true,
    user: {
      select: {
        isActive: true,
        userRolesByUserId: {
          where: { tenantId, revokedAt: null },
          select: { roleId: true },
        },
      },
    },
    member: {
      select: {
        companyId: true,
        divisionId: true,
        isActive: true,
        teamMembersByMemberId: {
          where: { tenantId, leftAt: null },
          select: {
            teamId: true,
            team: { select: { isActive: true } },
          },
        },
      },
    },
    clientContact: {
      select: {
        clientId: true,
        isActive: true,
        client: { select: { isActive: true } },
      },
    },
  }) satisfies Prisma.ActorProfileSelect;

type WorkRequestInfoRecord = Prisma.WorkRequestV1GetPayload<{
  select: typeof workRequestInfoSelect;
}>;
type WorkRequestInfoTarget = Prisma.ActorProfileGetPayload<{
  select: ReturnType<typeof workRequestInfoTargetSelect>;
}>;
type WorkRequestInfoParent = NonNullable<
  WorkRequestInfoRecord['bid'] | WorkRequestInfoRecord['directProject']
>;

export type WorkRequestInfoSnapshot = {
  request: WorkRequestInfoRecord;
  target: WorkRequestInfoTarget | null;
  parent: WorkRequestInfoParent | null;
};

export const workRequestInfoHistorySelect = {
  id: true,
  requestedByActorId: true,
  targetActorId: true,
  message: true,
  status: true,
  stateAtRequest: true,
  requestedAt: true,
  closedAt: true,
  responses: {
    orderBy: [{ respondedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      respondedByActorId: true,
      message: true,
      respondedAt: true,
    },
  },
} satisfies Prisma.WorkRequestV1InfoRequestSelect;
