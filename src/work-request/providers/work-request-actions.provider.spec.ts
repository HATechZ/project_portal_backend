import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { WorkRequestActionsProvider } from './work-request-actions.provider';

describe('WorkRequestActionsProvider', () => {
  const provider = new WorkRequestActionsProvider();
  it('exposes division assignment only at CREATED with its specific grant', () => {
    const actor = {
      role: {
        workflowActionRolePermissionsByRoleId: [
          { action: { code: WorkflowActionCode.WR_ASSIGN_DIVISION } },
        ],
      },
    } as never;
    expect(provider.available(actor, WorkRequestV1StateCode.CREATED)).toEqual([
      expect.objectContaining({ code: WorkflowActionCode.WR_ASSIGN_DIVISION }),
    ]);
    expect(
      provider.available(actor, WorkRequestV1StateCode.DIVISION_ASSIGNED),
    ).toEqual([]);
  });
  it('does not treat an unrelated permission as assignment authority', () => {
    const actor = {
      role: {
        workflowActionRolePermissionsByRoleId: [
          { action: { code: WorkflowActionCode.VIEW_WORK_REQUEST } },
        ],
      },
    } as never;
    expect(provider.available(actor, WorkRequestV1StateCode.CREATED)).toEqual(
      [],
    );
  });
});
