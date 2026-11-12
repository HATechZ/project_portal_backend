import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../../common/context/request-context';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ResponsibilityAssignment,
  ResponsibilityHistoryPort,
} from '../../contracts/work-request-responsibility-history.port';
import { UnitOfWorkService } from './unit-of-work.service';

@Injectable()
export class ResponsibilityHistoryAdapter implements ResponsibilityHistoryPort {
  constructor(private readonly uow: UnitOfWorkService) {}

  async recordAssignment(
    input: ResponsibilityAssignment,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    this.assertTransaction(input.tenantId, tx);
    const prior = await tx.workRequestResponsibilityHistory.findUnique({
      where: {
        tenantId_assignmentKey: {
          tenantId: input.tenantId,
          assignmentKey: input.assignmentKey,
        },
      },
    });
    if (prior) {
      if (
        prior.evidenceKind !== 'ASSIGNMENT' ||
        prior.workRequestId !== input.workRequestId ||
        prior.routeId !== input.routeId ||
        prior.actorProfileId !== input.actorProfileId ||
        prior.sourceMemberId !== input.sourceMemberId ||
        prior.sourceUserId !== input.sourceUserId ||
        prior.sourceRoleId !== input.sourceRoleId ||
        prior.selectionPolicy !== input.selectionPolicy ||
        prior.responsibilityType !== input.responsibilityType ||
        prior.divisionCycleId !== input.divisionCycleId ||
        prior.teamStepId !== input.teamStepId ||
        prior.sourceDivisionLeadId !== input.sourceDivisionLeadId ||
        prior.startedAt?.getTime() !== input.startedAt.getTime()
      ) {
        throw new Error(
          'Responsibility assignment retry identity conflicts with existing history.',
        );
      }
      return;
    }
    await tx.workRequestResponsibilityHistory.create({
      data: { id: randomUUID(), ...input, evidenceKind: 'ASSIGNMENT' },
    });
  }

  async endAssignment(
    tenantId: string,
    assignmentKey: string,
    endedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    this.assertTransaction(tenantId, tx);
    const prior = await tx.workRequestResponsibilityHistory.findUnique({
      where: { tenantId_assignmentKey: { tenantId, assignmentKey } },
    });
    if (!prior) throw new Error('Responsibility assignment was not found.');
    if (prior.endedAt) {
      if (prior.endedAt.getTime() !== endedAt.getTime())
        throw new Error(
          'Responsibility assignment already ended at a different time.',
        );
      return;
    }
    const closed = await tx.workRequestResponsibilityHistory.updateMany({
      where: { tenantId, assignmentKey, endedAt: null },
      data: { endedAt },
    });
    if (closed.count !== 1)
      throw new Error('Responsibility assignment changed concurrently.');
  }

  private assertTransaction(
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): void {
    if (
      tenantId !== RequestContext.requireTenantId() ||
      !this.uow.inTransaction ||
      !Object.is(this.uow.client, tx)
    ) {
      throw new Error(
        'Responsibility history requires the active tenant transaction.',
      );
    }
  }
}
