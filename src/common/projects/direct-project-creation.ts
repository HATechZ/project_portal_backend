import { randomUUID } from 'node:crypto';
import { OptionTypeCode, type Prisma } from '../../generated/prisma/client';
import type { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';

export type DirectProjectCreationInput = {
  id: string;
  tenantId: string;
  name: string;
  normalizedName: string;
  clientId: string;
  polId: string;
  podId: string;
  cargoId: string;
  vesselId: string;
  projectCode: string;
  shipmentNumber: string;
  actorId: string;
  snapshots: {
    polName: string;
    podName: string;
    cargoCode: string;
    vesselCode: string;
  };
  documents?: Prisma.DirectProjectCreateInput['documents'];
};

/** Shared canonical DirectProject persistence: aggregate, name claim, and initial status. */
export async function createDirectProject(
  db: PrismaExecutor,
  input: DirectProjectCreationInput,
): Promise<void> {
  await assertDirectProjectReferences(db, input);
  const status = await db.directProjectStatus.findUniqueOrThrow({
    where: { code: 'ACTIVE' },
    select: { id: true },
  });
  await db.directProject.create({
    data: {
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      clientId: input.clientId,
      polId: input.polId,
      podId: input.podId,
      cargoId: input.cargoId,
      vesselId: input.vesselId,
      projectCode: input.projectCode,
      polNameSnapshot: input.snapshots.polName,
      podNameSnapshot: input.snapshots.podName,
      cargoCodeSnapshot: input.snapshots.cargoCode,
      vesselCodeSnapshot: input.snapshots.vesselCode,
      shipmentNumber: input.shipmentNumber,
      createdByActorId: input.actorId,
      ...(input.documents ? { documents: input.documents } : {}),
    },
  });
  await db.businessNameClaim.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      normalizedName: input.normalizedName,
      directProjectId: input.id,
    },
  });
  await db.directProjectStatusEvent.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      directProjectId: input.id,
      toStatusId: status.id,
      changedByActorId: input.actorId,
    },
  });
}

async function assertDirectProjectReferences(
  db: PrismaExecutor,
  input: DirectProjectCreationInput,
): Promise<void> {
  const client = await db.client.findFirst({
    where: { id: input.clientId, tenantId: input.tenantId, isActive: true },
    select: { id: true },
  });
  if (!client) throw new Error('PROJECT_CLIENT');
  const requested = new Map<OptionTypeCode, string>([
    [OptionTypeCode.POL, input.polId],
    [OptionTypeCode.POD, input.podId],
    [OptionTypeCode.CARGO_CODE, input.cargoId],
    [OptionTypeCode.VESSEL_CODE, input.vesselId],
  ]);
  const options = await db.optionValue.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      id: { in: [...requested.values()] },
      optionType: { code: { in: [...requested.keys()] } },
    },
    select: { id: true, optionType: { select: { code: true } } },
  });
  const byType = new Map(
    options.map((value) => [value.optionType.code, value.id]),
  );
  if ([...requested.entries()].some(([type, id]) => byType.get(type) !== id))
    throw new Error('PROJECT_REFERENCE_OPTION');
}

export function normalizeDirectProjectName(value: string): string {
  return value.trim().toLowerCase();
}
