import { Injectable } from '@nestjs/common';
import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
@Injectable()
export class WorkRequestActionsProvider {
  available(actor: SessionActor, state: WorkRequestV1StateCode | null) {
    const grants = new Set(
      actor.role.workflowActionRolePermissionsByRoleId.map(
        ({ action }) => action.code,
      ),
    );
    return state === WorkRequestV1StateCode.CREATED &&
      grants.has(WorkflowActionCode.WR_ASSIGN_DIVISION)
      ? [
          {
            code: WorkflowActionCode.WR_ASSIGN_DIVISION,
            label: 'Assign Division',
            targetKind: 'division',
          },
        ]
      : [];
  }
}
