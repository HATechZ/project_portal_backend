import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestV1StateCode } from '../../generated/prisma/client';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export type BidBusinessReadiness = {
  ready: boolean;
  cycleId: string | null;
  total: number;
  accepted: number;
  blocking: string[];
};

/** C3's single authoritative readiness calculation. */
@Injectable()
export class BidBusinessReadinessProvider {
  constructor(private readonly uow: UnitOfWorkService) {}

  async evaluate(bidId: string): Promise<BidBusinessReadiness> {
    const tenantId = RequestContext.requireTenantId();
    const db = this.uow.client;
    const cycle = await db.bidBusinessCycle.findFirst({
      where: { tenantId, bidId, closedAt: null },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!cycle)
      return { ready: false, cycleId: null, total: 0, accepted: 0, blocking: ['NO_OPEN_CYCLE'] };
    const requests = await db.workRequestV1.findMany({
      where: { tenantId, bidId, bidBusinessCycleId: cycle.id },
      select: {
        id: true,
        events: {
          take: 1,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          select: { resultingState: true },
        },
      },
    });
    const accepted = requests.filter(
      (request) => request.events[0]?.resultingState === WorkRequestV1StateCode.ACCEPTED,
    ).length;
    const blocking = requests
      .filter((request) => request.events[0]?.resultingState !== WorkRequestV1StateCode.ACCEPTED)
      .map((request) => request.id);
    if (!requests.length) blocking.push('ZERO_WORK_REQUESTS');
    return { ready: requests.length > 0 && blocking.length === 0, cycleId: cycle.id, total: requests.length, accepted, blocking };
  }
}
