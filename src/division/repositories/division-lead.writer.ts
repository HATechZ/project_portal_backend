import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import {
  DivisionLeadRecord,
  DivisionLeadRevokedIncumbent,
  divisionLeadMemberSelect,
} from './division-lead.records';

export interface ActiveLeadRow {
  id: string;
  assignedAt: Date;
  assignedByUserId: string;
  member: { id: string; name: string; email: string };
}

export interface AssignmentWrite {
  assignedAt: Date;
  revokedIncumbent: DivisionLeadRevokedIncumbent | null;
  idempotent: boolean;
}

export function leadNotFound(message: string): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}

export function leadConflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}

export function findActiveLeadRow(
  db: PrismaExecutor,
  tenantId: string,
  divisionId: string,
  companyId: string,
): Promise<ActiveLeadRow | null> {
  return db.divisionLead.findFirst({
    where: { tenantId, divisionId, companyId, revokedAt: null },
    select: {
      id: true,
      assignedAt: true,
      assignedByUserId: true,
      member: { select: divisionLeadMemberSelect },
    },
  });
}

export function toLeadRecord(row: ActiveLeadRow): DivisionLeadRecord {
  return {
    member: row.member,
    assignedAt: row.assignedAt,
    assignedByUserId: row.assignedByUserId,
  };
}

/**
 * Revokes the sitting Lead and inserts the new one, or short-circuits when the
 * Member already leads this Division.
 *
 * 04.1.1 DR-03 allows at most one active Lead per Division; the partial unique
 * index `division_leads_one_active_per_division` is the race backstop behind
 * this read-then-write pair, which runs at Serializable isolation.
 */
export async function writeAssignment(
  db: PrismaExecutor,
  input: {
    tenantId: string;
    companyId: string;
    divisionId: string;
    memberId: string;
    assignedByUserId: string;
  },
): Promise<AssignmentWrite> {
  const { tenantId, companyId, divisionId, memberId } = input;
  const existing = await db.divisionLead.findFirst({
    where: { tenantId, divisionId, memberId, revokedAt: null },
    select: { assignedAt: true },
  });
  if (existing) {
    return {
      assignedAt: existing.assignedAt,
      revokedIncumbent: null,
      idempotent: true,
    };
  }

  const incumbent = await findActiveLeadRow(
    db,
    tenantId,
    divisionId,
    companyId,
  );
  let revokedIncumbent: DivisionLeadRevokedIncumbent | null = null;
  if (incumbent) {
    const revokedAt = new Date();
    await db.divisionLead.update({
      where: { id: incumbent.id },
      data: { revokedAt, revokedByUserId: input.assignedByUserId },
    });
    revokedIncumbent = { member: incumbent.member, revokedAt };
  }

  const created = await db.divisionLead.create({
    data: {
      tenantId,
      id: randomUUID(),
      companyId,
      divisionId,
      memberId,
      assignedByUserId: input.assignedByUserId,
    },
    select: { assignedAt: true },
  });
  return {
    assignedAt: created.assignedAt,
    revokedIncumbent,
    idempotent: false,
  };
}
