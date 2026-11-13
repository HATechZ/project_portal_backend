import { Inject, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  RESPONSIBILITY_HISTORY,
  type ResponsibilityHistoryPort,
} from '../../contracts/work-request-responsibility-history.port';
import {
  RESPONSIBILITY_PROFILE_RESOLVER,
  type ResponsibilityProfileResolverPort,
} from '../../contracts/responsibility-profile-resolver.port';
import { replaceDivisionLeadResponsibilities } from '../../infra/prisma/responsibility-history.writer';
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
  constructor(
    unitOfWork: UnitOfWorkService,
    @Inject(RESPONSIBILITY_HISTORY)
    private readonly responsibilityHistory?: ResponsibilityHistoryPort,
    @Inject(RESPONSIBILITY_PROFILE_RESOLVER)
    private readonly responsibilityProfiles?: ResponsibilityProfileResolverPort,
  ) {
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

        const member = await db.member.findFirst({
          where: {
            id: input.memberId,
            divisionId: input.divisionId,
            tenantId,
            companyId: input.companyId,
            isActive: true,
          },
          select: { id: true, name: true, email: true, userId: true },
        });
        if (!member)
          throw leadNotFound('Active Member was not found in this Division');
        const prior = await findActiveLeadRow(
          db,
          tenantId,
          input.divisionId,
          input.companyId,
        );
        const written = await writeAssignment(db, {
          tenantId,
          companyId: input.companyId,
          divisionId: input.divisionId,
          memberId: member.id,
          assignedByUserId: input.assignedByUserId,
        });
        const current = await findActiveLeadRow(
          db,
          tenantId,
          input.divisionId,
          input.companyId,
        );
        if (!current) throw leadNotFound('Division has no active Lead');
        if (written.idempotent) {
          return {
            division,
            member,
            ...written,
          };
        }
        if (this.responsibilityHistory && this.responsibilityProfiles)
          await replaceDivisionLeadResponsibilities({
            db,
            history: this.responsibilityHistory,
            profiles: this.responsibilityProfiles,
            tenantId,
            divisionId: input.divisionId,
            priorDivisionLeadId: prior?.id ?? null,
            currentDivisionLeadId: current.id,
            changedAt: written.assignedAt,
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
      if (this.responsibilityHistory && this.responsibilityProfiles)
        await replaceDivisionLeadResponsibilities({
          db,
          history: this.responsibilityHistory,
          profiles: this.responsibilityProfiles,
          tenantId,
          divisionId: input.divisionId,
          priorDivisionLeadId: active.id,
          currentDivisionLeadId: null,
          changedAt: new Date(),
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
