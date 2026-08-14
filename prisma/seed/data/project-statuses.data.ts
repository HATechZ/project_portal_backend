import { ProjectStatusCode } from '../../../src/generated/prisma/client';

export const projectStatuses = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    code: ProjectStatusCode.DRAFT,
    name: 'Draft',
    sortOrder: 10,
    isTerminal: false,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    code: ProjectStatusCode.BIDDING,
    name: 'Bidding',
    sortOrder: 20,
    isTerminal: false,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    code: ProjectStatusCode.ACTIVE,
    name: 'Active',
    sortOrder: 30,
    isTerminal: false,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    code: ProjectStatusCode.COMPLETED,
    name: 'Completed',
    sortOrder: 40,
    isTerminal: true,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    code: ProjectStatusCode.ARCHIVED,
    name: 'Archived',
    sortOrder: 50,
    isTerminal: true,
  },
] as const;
