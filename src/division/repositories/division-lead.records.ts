import { ActorRoleCode } from '../../generated/prisma/client';

export const divisionLeadMemberSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export interface DivisionLeadMemberSummary {
  id: string;
  name: string;
  email: string;
}

/** The Lead retired by an assignment, or `null` when the Division had none. */
export interface DivisionLeadRevokedIncumbent {
  member: DivisionLeadMemberSummary;
  revokedAt: Date;
}

export interface DivisionLeadAssignmentRecord {
  division: {
    id: string;
    name: string;
    abbr: string;
  };
  member: {
    id: string;
    name: string;
    email: string;
    userId: string;
  };
  roleCode: ActorRoleCode;
  userRoleActive: boolean;
  actorProfileLinked: boolean;
  assignedAt: Date;
  revokedIncumbent: DivisionLeadRevokedIncumbent | null;
  /** True when the Member already led this Division and no row was written. */
  idempotent: boolean;
}

/** An active Lead row. Revoked rows are never projected into this shape. */
export interface DivisionLeadRecord {
  member: DivisionLeadMemberSummary;
  assignedAt: Date;
  assignedByUserId: string;
}
