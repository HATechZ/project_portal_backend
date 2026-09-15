import { ActorRoleCode } from '../../generated/prisma/client';

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
}
