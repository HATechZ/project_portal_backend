import { Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { PermissionCode } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';
import {
  AppendWorkRequestMemberStepDto,
  DefineWorkRequestMemberSequenceDto,
  DefineWorkRequestTeamSequenceDto,
  SubmitWorkRequestMemberStepDto,
} from '../dtos/work-request.dto';
import { WorkRequestExecutionRepository } from '../repositories/work-request-execution.repository';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';
import { WorkRequestInternalWorkflowProvider } from './work-request-internal-workflow.provider';
import { WorkRequestLifecycleProvider } from './work-request-lifecycle.provider';

@Injectable()
export class WorkRequestExecutionProvider {
  constructor(
    private readonly execution: WorkRequestExecutionRepository,
    private readonly internalWorkflow: WorkRequestInternalWorkflowProvider,
    private readonly reads: WorkRequestReadRepository,
    private readonly lifecycle?: WorkRequestLifecycleProvider,
  ) {}

  async internalCycle(id: string, cycleId: string, actor: SessionActor) {
    const admin = hasTenantWideInternalAuthority(actor);
    const cycle = await this.execution.internalCycle(
      id,
      cycleId,
      memberId(actor, admin),
      admin,
    );
    const { route, routeStep, ...publicCycle } = cycle;
    void route;
    return {
      ...publicCycle,
      routeStep: {
        divisionId: routeStep.divisionId,
        division: routeStep.division,
      },
      internalWorkflow: this.internalWorkflow.project(cycle),
      availableActions: (await this.lifecycle?.isArchived(id))
        ? []
        : cycle.availableActions.filter((action) =>
            hasPermission(actor, EXECUTION_PERMISSION[action]),
          ),
    };
  }
  async internalCycles(id: string, actor: SessionActor) {
    if (!(await this.reads.find(id, actor))) throw notFound();
    const admin = hasTenantWideInternalAuthority(actor);
    const cycles = await this.execution.internalCycles(
      id,
      memberId(actor, admin),
      admin,
    );
    return {
      authorizedInternalWorkflows: cycles.map((cycle) => ({
        divisionId: cycle.routeStep.divisionId!,
        divisionName: cycle.routeStep.division!.name,
        divisionCycleId: cycle.id,
        internalWorkflow: this.internalWorkflow.project(cycle),
      })),
    };
  }
  defineTeamSequence(
    id: string,
    cycleId: string,
    input: DefineWorkRequestTeamSequenceDto,
    actor: SessionActor,
  ) {
    assertScope(actor, 'division');
    const admin = hasTenantWideInternalAuthority(actor);
    return this.runWhenActive(id, () =>
      this.execution.defineTeamSequence(
        id,
        cycleId,
        input.teamIds,
        actor.id,
        memberId(actor, admin),
        admin,
      ),
    );
  }
  defineMemberSequence(
    id: string,
    teamStepId: string,
    input: DefineWorkRequestMemberSequenceDto,
    actor: SessionActor,
  ) {
    assertScope(actor, 'team');
    const admin = hasTenantWideInternalAuthority(actor);
    return this.runWhenActive(id, () =>
      this.execution.defineMemberSequence(
        id,
        teamStepId,
        input.memberIds,
        actor.id,
        memberId(actor, admin),
        admin,
      ),
    );
  }
  appendMemberStep(
    id: string,
    teamStepId: string,
    input: AppendWorkRequestMemberStepDto,
    actor: SessionActor,
  ) {
    assertScope(actor, 'team');
    const admin = hasTenantWideInternalAuthority(actor);
    return this.runWhenActive(id, () =>
      this.execution.appendMemberStep(
        id,
        teamStepId,
        input.memberId,
        actor.id,
        memberId(actor, admin),
        admin,
      ),
    );
  }
  submitMemberStep(
    id: string,
    memberStepId: string,
    input: SubmitWorkRequestMemberStepDto,
    actor: SessionActor,
  ) {
    assertScope(actor, 'member');
    const admin = hasTenantWideInternalAuthority(actor);
    return this.runWhenActive(id, () =>
      this.execution.submitMemberStep(
        id,
        memberStepId,
        actor.id,
        memberId(actor, admin),
        input,
        admin,
      ),
    );
  }
  completeTeamStep(id: string, teamStepId: string, actor: SessionActor) {
    assertScope(actor, 'team');
    const admin = hasTenantWideInternalAuthority(actor);
    return this.runWhenActive(id, () =>
      this.execution.completeTeamStep(
        id,
        teamStepId,
        actor.id,
        memberId(actor, admin),
        admin,
      ),
    );
  }

  private runWhenActive<T>(id: string, operation: () => T): T | Promise<T> {
    return this.lifecycle
      ? this.lifecycle.assertActive(id).then(operation)
      : operation();
  }
}

function memberId(actor: SessionActor, admin: boolean) {
  if (admin) return null;
  if (!actor.member?.id) throw forbidden();
  return actor.member.id;
}

function assertScope(
  actor: SessionActor,
  scope: 'division' | 'team' | 'member',
): void {
  if (
    !hasTenantWideInternalAuthority(actor) &&
    actor.role.customScope !== scope
  )
    throw forbidden();
}

const EXECUTION_PERMISSION: Record<string, PermissionCode> = {
  DEFINE_TEAM_SEQUENCE: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
  DEFINE_MEMBER_SEQUENCE: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  APPEND_MEMBER_STEP: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  SUBMIT_MEMBER_STEP: PermissionCode.SUBMIT_WORK_REQUEST,
  COMPLETE_TEAM_STEP: PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
};

function hasPermission(
  actor: SessionActor,
  required: PermissionCode | undefined,
) {
  return (
    !!required &&
    actor.role.rolePermissions.some(
      ({ revokedAt, permission }) =>
        revokedAt === null &&
        permission.code === required &&
        (actor.role.customScope === null ||
          permission.scopeCompatibilities.some(
            ({ scope }) => scope === actor.role.customScope,
          )),
    )
  );
}

function forbidden(): AppException {
  return new AppException({
    code: AppErrorCode.Forbidden,
    status: 403,
    message: "You don't have permission to perform this action.",
  });
}

function notFound(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: 404,
    message: 'Work Request was not found.',
  });
}
