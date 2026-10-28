import { Injectable } from '@nestjs/common';
import { PermissionCode } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';
import {
  AppendWorkRequestMemberStepDto,
  DefineWorkRequestMemberSequenceDto,
  DefineWorkRequestTeamSequenceDto,
} from '../dtos/work-request.dto';
import { WorkRequestExecutionRepository } from '../repositories/work-request-execution.repository';

@Injectable()
export class WorkRequestExecutionProvider {
  constructor(private readonly execution: WorkRequestExecutionRepository) {}

  async internalCycle(id: string, cycleId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    const cycle = await this.execution.internalCycle(
      id,
      cycleId,
      memberId(actor, admin),
      admin,
    );
    return {
      ...cycle,
      availableActions: cycle.availableActions.filter((action) =>
        hasPermission(actor, EXECUTION_PERMISSION[action]),
      ),
    };
  }
  defineTeamSequence(id: string, cycleId: string, input: DefineWorkRequestTeamSequenceDto, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    return this.execution.defineTeamSequence(id, cycleId, input.teamIds, actor.id, memberId(actor, admin), admin);
  }
  defineMemberSequence(id: string, teamStepId: string, input: DefineWorkRequestMemberSequenceDto, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    return this.execution.defineMemberSequence(id, teamStepId, input.memberIds, actor.id, memberId(actor, admin), admin);
  }
  appendMemberStep(id: string, teamStepId: string, input: AppendWorkRequestMemberStepDto, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    return this.execution.appendMemberStep(id, teamStepId, input.memberId, actor.id, memberId(actor, admin), admin);
  }
  submitMemberStep(id: string, memberStepId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    return this.execution.submitMemberStep(id, memberStepId, actor.id, memberId(actor, admin), admin);
  }
  completeTeamStep(id: string, teamStepId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    return this.execution.completeTeamStep(id, teamStepId, actor.id, memberId(actor, admin), admin);
  }
}

function memberId(actor: SessionActor, admin: boolean) {
  if (admin) return null;
  if (!actor.member?.id) throw new Error('WR_ROUTE_MEMBER');
  return actor.member.id;
}

const EXECUTION_PERMISSION: Record<string, PermissionCode> = {
  DEFINE_TEAM_SEQUENCE: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
  DEFINE_MEMBER_SEQUENCE: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  APPEND_MEMBER_STEP: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  SUBMIT_MEMBER_STEP: PermissionCode.SUBMIT_WORK_REQUEST,
  COMPLETE_TEAM_STEP: PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
};

function hasPermission(actor: SessionActor, required: PermissionCode | undefined) {
  return !!required && actor.role.rolePermissions.some(
    ({ revokedAt, permission }) =>
      revokedAt === null &&
      permission.code === required &&
      (actor.role.customScope === null ||
        permission.scopeCompatibilities.some(
          ({ scope }) => scope === actor.role.customScope,
        )),
  );
}
