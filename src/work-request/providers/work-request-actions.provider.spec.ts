import {
  WorkflowActionCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { WorkRequestActionsProvider } from './work-request-actions.provider';

describe('WorkRequestActionsProvider', () => {
  const provider = new WorkRequestActionsProvider();
  const record = (
    state: WorkRequestV1StateCode,
    assignments = [],
    infoRequests: { targetActorId: string }[] = [],
  ) =>
    ({
      bid: { client: { companyId: 'company' } },
      directProject: null,
      assignments,
      events: [{ resultingState: state }],
      infoRequests,
    }) as never;
  const actor = (
    permissions: WorkflowActionCode[],
    memberId = 'member',
    customScope: string | null = null,
  ) =>
    ({
      id: 'actor-a',
      boundTeamId: customScope === 'team' ? 'team-a' : null,
      role: {
        isSystemRole: customScope === null,
        customScope,
        userRolesByRoleId: [
          { teamId: customScope === 'team' ? 'team-a' : null },
        ],
        workflowActionRolePermissionsByRoleId: permissions.map((code) => ({
          action: { code },
        })),
      },
      member: {
        id: memberId,
        isActive: true,
        companyId: 'company',
        company: { isActive: true },
        division: { isActive: true },
        divisionId: 'division',
        divisionLeadsByMemberId: [],
      },
    }) as never;
  it('exposes division assignment only at CREATED with its specific grant', () => {
    expect(
      provider.available(
        actor([WorkflowActionCode.WR_ASSIGN_DIVISION]),
        WorkRequestV1StateCode.CREATED,
        record(WorkRequestV1StateCode.CREATED),
      ),
    ).toEqual([
      expect.objectContaining({ code: WorkflowActionCode.WR_ASSIGN_DIVISION }),
    ]);
    expect(
      provider.available(
        actor([WorkflowActionCode.WR_ASSIGN_DIVISION]),
        WorkRequestV1StateCode.TEAM_ASSIGNED,
        record(WorkRequestV1StateCode.TEAM_ASSIGNED),
      ),
    ).toEqual([]);
  });
  it('does not treat an unrelated permission as assignment authority', () => {
    expect(
      provider.available(
        actor([WorkflowActionCode.VIEW_WORK_REQUEST]),
        WorkRequestV1StateCode.CREATED,
        record(WorkRequestV1StateCode.CREATED),
      ),
    ).toEqual([]);
  });
  it('exposes WR_SUBMIT only for the active assigned Member in Phase 3', () => {
    const assigned = record(WorkRequestV1StateCode.MEMBER_ASSIGNED, [
      { level: 'MEMBER', memberId: 'member-a' },
    ]);
    expect(
      provider.available(
        actor([WorkflowActionCode.WR_SUBMIT], 'member-a'),
        WorkRequestV1StateCode.MEMBER_ASSIGNED,
        assigned,
      ),
    ).toEqual([
      expect.objectContaining({ code: WorkflowActionCode.WR_SUBMIT }),
    ]);
    expect(
      provider.available(
        actor([WorkflowActionCode.WR_SUBMIT]),
        WorkRequestV1StateCode.MEMBER_ASSIGNED,
        assigned,
      ),
    ).toEqual([]);
  });

  it('exposes Request Information only with its exact grant', () => {
    expect(
      provider.available(
        actor([WorkflowActionCode.REQUEST_WORKFLOW_INFO]),
        WorkRequestV1StateCode.MEMBER_ASSIGNED,
        record(WorkRequestV1StateCode.MEMBER_ASSIGNED),
      ),
    ).toEqual([
      expect.objectContaining({
        code: WorkflowActionCode.REQUEST_WORKFLOW_INFO,
      }),
    ]);
  });

  it('exposes Respond Information only for an applicable open request target', () => {
    const applicable = record(
      WorkRequestV1StateCode.MEMBER_ASSIGNED,
      [],
      [{ targetActorId: 'actor-a' }],
    );
    const responseActor = actor([WorkflowActionCode.RESPOND_WORKFLOW_INFO]);

    expect(
      provider.available(
        responseActor,
        WorkRequestV1StateCode.MEMBER_ASSIGNED,
        applicable,
      ),
    ).toEqual([
      expect.objectContaining({
        code: WorkflowActionCode.RESPOND_WORKFLOW_INFO,
      }),
    ]);
    expect(
      provider.available(
        responseActor,
        WorkRequestV1StateCode.MEMBER_ASSIGNED,
        record(WorkRequestV1StateCode.MEMBER_ASSIGNED),
      ),
    ).toEqual([]);
  });

  it('hides information actions outside a DIVISION custom-role boundary', () => {
    expect(
      provider.available(
        actor([WorkflowActionCode.REQUEST_WORKFLOW_INFO], 'member', 'division'),
        WorkRequestV1StateCode.DIVISION_ASSIGNED,
        record(WorkRequestV1StateCode.DIVISION_ASSIGNED, [
          { level: 'DIVISION', divisionId: 'division-other' },
        ]),
      ),
    ).toEqual([]);
  });
});
