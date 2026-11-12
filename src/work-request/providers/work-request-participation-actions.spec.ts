import {
  PermissionCode,
  WorkRequestRouteStepKind,
} from '../../generated/prisma/client';
import { WorkRequestRouteActionsProvider } from './work-request-route-actions.provider';

describe('completed Member actions', () => {
  it('keeps eligible Request Info but removes execution actions after handoff', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const actor = {
      id: 'actor-a',
      member: { id: 'member-a', isActive: true, divisionLeadsByMemberId: [] },
      role: {
        customScope: 'member',
        rolePermissions: [
          PermissionCode.REQUEST_INFO,
          PermissionCode.SUBMIT_WORK_REQUEST,
          PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
          PermissionCode.ROUTE_FOR_REVIEW,
        ].map((code) => ({
          revokedAt: null,
          permission: { code, scopeCompatibilities: [{ scope: 'member' }] },
        })),
      },
    } as never;
    const route = {
      responsibleOriginatingLead: {
        memberId: 'lead',
        revokedAt: null,
        member: { isActive: true },
        division: { isActive: true },
      },
      projection: {
        divisionCycleId: 'cycle',
        routeStepId: 'route-step',
        teamStepId: 'team',
        memberStepId: 'member-step-b',
        openRevisionId: null,
      },
      steps: [
        { id: 'route-step', kind: WorkRequestRouteStepKind.INTERMEDIATE },
      ],
      divisionCycles: [
        {
          id: 'cycle',
          completedAt: null,
          routeStep: { divisionId: 'division' },
          teamSteps: [
            {
              id: 'team',
              activatedAt: at,
              completedAt: null,
              team: { leadMemberId: 'team-lead' },
              memberSteps: [
                {
                  id: 'member-step-a',
                  memberId: 'member-a',
                  activatedAt: at,
                  submittedAt: at,
                },
                {
                  id: 'member-step-b',
                  memberId: 'member-b',
                  activatedAt: at,
                  submittedAt: null,
                },
              ],
            },
          ],
        },
      ],
    };
    const communications = {
      route: jest.fn().mockResolvedValue(route),
      isRelatedActor: jest.fn().mockResolvedValue(true),
      recipientActorIds: jest.fn().mockResolvedValue([{ id: 'actor-b' }]),
    };
    const result = await new WorkRequestRouteActionsProvider(
      communications as never,
    ).available('request-a', actor);
    const codes = result?.map((action) => action.code);
    expect(codes).toContain('REQUEST_WORKFLOW_INFO');
    expect(codes).not.toContain('SUBMIT_MEMBER_STEP');
    expect(codes).not.toContain('COMPLETE_TEAM_STEP');
    expect(codes).not.toContain('FORWARD_ROUTE');
  });
});
