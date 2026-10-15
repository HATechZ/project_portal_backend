import { Prisma } from '../../generated/prisma/client';

const participantSelect = {
  id: true,
  isActive: true,
  member: {
    select: {
      id: true,
      companyId: true,
      isActive: true,
      company: { select: { isActive: true } },
    },
  },
  clientContact: {
    select: {
      id: true,
      clientId: true,
      isActive: true,
      client: { select: { isActive: true } },
    },
  },
} satisfies Prisma.ActorProfileSelect;

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
    select: {
      level: true,
      divisionId: true,
      teamId: true,
      memberId: true,
      team: { select: { leadMemberId: true, isActive: true } },
    },
  },
} satisfies Prisma.WorkRequestV1Select;

export const workRequestInfoTargetSelect = () => participantSelect;

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
  info: { requestedByActorId: string; targetActorId: string } | null;
};

export const workRequestInfoHistorySelect = {
  id: true,
  parentInfoRequestId: true,
  requestedByActor: { select: participantSelect },
  targetActor: { select: participantSelect },
  message: true,
  status: true,
  stateAtRequest: true,
  requestedAt: true,
  closedAt: true,
  attachments: { select: { documentVersionId: true } },
  responses: {
    orderBy: [{ respondedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      respondedByActor: { select: participantSelect },
      message: true,
      respondedAt: true,
      attachments: { select: { documentVersionId: true } },
    },
  },
} satisfies Prisma.WorkRequestV1InfoRequestSelect;
