import { WorkspaceTypeCode } from '../../../src/generated/prisma/client';

export const workspaceTypes = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    code: WorkspaceTypeCode.BID,
    name: 'Bid',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    code: WorkspaceTypeCode.PROJECT,
    name: 'Project',
  },
] as const;
