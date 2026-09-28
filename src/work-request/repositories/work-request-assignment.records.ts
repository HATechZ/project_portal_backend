import {
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';

export type WorkRequestAssignmentSnapshot = {
  parentCompanyId: string | null;
  state: WorkRequestV1StateCode | null;
  active: Partial<Record<WorkRequestV1AssignmentLevelCode, string>>;
  target: {
    companyId: string;
    divisionId: string;
    teamId: string | null;
  } | null;
  boundTeam: { id: string; companyId: string; divisionId: string } | null;
};
