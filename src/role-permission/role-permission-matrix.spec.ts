import { ActorRoleCode, WorkflowActionCode } from '../generated/prisma/client';
import { rolePermissionCodes } from '../../prisma/seed/data/permissions.data';

const grants = (role: ActorRoleCode) => new Set(rolePermissionCodes[role]);

describe('default role permission matrix', () => {
  it('keeps supervisor permissions but reserves the client bid decision', () => {
    expect(grants(ActorRoleCode.system_admin)).toContain(
      WorkflowActionCode.SEND_BACKWARD,
    );
    expect(grants(ActorRoleCode.system_admin)).not.toContain(
      WorkflowActionCode.DECIDE_BID_OUTCOME,
    );
  });

  it('keeps CCR out of organization management and other workflow owners', () => {
    const ccr = grants(ActorRoleCode.ccr_coordinator);
    for (const code of [
      WorkflowActionCode.ADD_COMPANY,
      WorkflowActionCode.ADD_DIVISION,
      WorkflowActionCode.ADD_TEAM,
      WorkflowActionCode.ADD_MEMBER,
      WorkflowActionCode.ENGINEERING_SUBMIT_TO_MARKETING,
      WorkflowActionCode.FORWARD_TO_CCR,
      WorkflowActionCode.DECIDE_BID_OUTCOME,
      WorkflowActionCode.SEND_BACKWARD,
    ]) {
      expect(ccr).not.toContain(code);
    }
  });

  it('matches PM lead and member creation boundaries', () => {
    expect(grants(ActorRoleCode.division_lead)).not.toContain(
      WorkflowActionCode.ADD_WORK_REQUEST,
    );
    expect(grants(ActorRoleCode.division_lead)).toContain(
      WorkflowActionCode.FORWARD_TO_CCR,
    );
    expect(grants(ActorRoleCode.division_member)).not.toContain(
      WorkflowActionCode.ADD_WORK_REQUEST,
    );
  });

  it('separates the TMS manager, drawing, checking, and approval duties', () => {
    expect(grants(ActorRoleCode.tms_manager)).toContain(
      WorkflowActionCode.ENGINEERING_REQUEST_PM_REVISION,
    );
    expect(grants(ActorRoleCode.tms_drawing)).toEqual(
      new Set([
        WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
        WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.SUBMIT_DRAWING,
        WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
      ]),
    );
    expect(grants(ActorRoleCode.tms_checking)).toEqual(
      new Set([
        WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
        WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.REVIEW_CHECKING_APPROVE,
        WorkflowActionCode.REVIEW_CHECKING_REJECT,
        WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
      ]),
    );
    expect(grants(ActorRoleCode.tms_approval)).toContain(
      WorkflowActionCode.REVIEW_APPROVAL_APPROVE,
    );
    expect(grants(ActorRoleCode.tms_approval)).not.toContain(
      WorkflowActionCode.ENGINEERING_SUBMIT_TO_MARKETING,
    );
  });

  it('gives the client separate information, final, and bid decisions', () => {
    const client = grants(ActorRoleCode.client_owner);
    expect(client).toContain(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    expect(client).toContain(WorkflowActionCode.CLIENT_ACCEPT_FINAL);
    expect(client).toContain(WorkflowActionCode.DECIDE_BID_OUTCOME);
  });

  it('does not contain duplicate permission grants', () => {
    for (const role of Object.values(ActorRoleCode)) {
      expect(rolePermissionCodes[role]).toHaveLength(grants(role).size);
    }
  });
});
