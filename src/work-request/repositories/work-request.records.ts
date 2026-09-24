import { Prisma } from '../../generated/prisma/client';

export const workRequestSelect = {
  id: true,
  bidId: true,
  directProjectId: true,
  title: true,
  priority: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdByActor: { select: { id: true, label: true } },
  bid: { select: { clientId: true, client: { select: { companyId: true } } } },
  directProject: {
    select: { clientId: true, client: { select: { companyId: true } } },
  },
  events: {
    take: 1,
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { resultingState: true },
  },
  documents: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      documentCodeId: true,
      documentCodeSnapshot: true,
      originalFileName: true,
      generatedFileName: true,
      mimeType: true,
      fileSizeBytes: true,
    },
  },
} satisfies Prisma.WorkRequestV1Select;

export type WorkRequestRecord = Prisma.WorkRequestV1GetPayload<{
  select: typeof workRequestSelect;
}>;
