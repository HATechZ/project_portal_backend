import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  DivisionLeadAssignmentRecord,
  DivisionLeadRecord,
} from './division-lead.records';
import {
  findActiveLeadRow,
  leadNotFound,
  toLeadRecord,
  writeAssignment,
} from './division-lead.writer';

interface AssignInput {
  companyId: string;
  divisionId: string;
  memberId: string;
  assignedByUserId: string;
}

@Injectable()
export class DivisionLeadRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  assign(input: AssignInput): Promise<DivisionLeadAssignmentRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const division = await db.division.findUnique({
          where: {
            id_tenantId_companyId: {
              id: input.divisionId,
              tenantId,
              companyId: input.companyId,
            },
          },
          select: { id: true, name: true, abbr: true },
        });
        if (!division) throw leadNotFound('Division was not found');

        // 04.1.1 DR-04: same Tenant and Company is the whole requirement. The
        // Member's own Division is deliberately not compared — that single
        // column is what limited a Member to leading one Division.
        const member = await db.member.findFirst({
          where: {
            id: input.memberId,
            tenantId,
            companyId: input.companyId,
            isActive: true,
          },
          select: { id: true, name: true, email: true, userId: true },
        });
        if (!member) throw leadNotFound('Member was not found in this Company');
        const written = await writeAssignment(db, {
          tenantId,
          companyId: input.companyId,
          divisionId: input.divisionId,
          memberId: member.id,
          assignedByUserId: input.assignedByUserId,
        });

        return {
          division,
          member,
          ...written,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  revoke(input: {
    companyId: string;
    divisionId: string;
    revokedByUserId: string;
  }): Promise<DivisionLeadRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const active = await findActiveLeadRow(
        db,
        tenantId,
        input.divisionId,
        input.companyId,
      );
      if (!active) throw leadNotFound('Division has no active Lead');
      // DR-06 / non-negotiable #9: revoked by timestamp, never deleted.
      await db.divisionLead.update({
        where: { id: active.id },
        data: { revokedAt: new Date(), revokedByUserId: input.revokedByUserId },
      });
      return toLeadRecord(active);
    });
  }

  findActiveLead(
    divisionId: string,
    companyId: string,
  ): Promise<DivisionLeadRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const active = await findActiveLeadRow(
        db,
        tenantId,
        divisionId,
        companyId,
      );
      return active ? toLeadRecord(active) : null;
    });
  }
}
