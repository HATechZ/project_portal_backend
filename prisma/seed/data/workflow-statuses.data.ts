import { WorkRequestStatusCode } from '../../../src/generated/prisma/client';

const title = (code: string) =>
  code
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const codes = Object.values(WorkRequestStatusCode);

export const workflowStatuses = codes.map((code, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  code,
  name: title(code),
  description: `${title(code)} workflow status.`,
  sortOrder: (index + 1) * 10,
  isTerminal:
    code === WorkRequestStatusCode.HML_LISTED ||
    code === WorkRequestStatusCode.REJECTED,
}));
