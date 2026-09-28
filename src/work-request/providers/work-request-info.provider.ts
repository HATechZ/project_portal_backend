import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkflowActionCode } from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ObjectScopeProvider } from '../../common/security/object-scope.provider';
import type { SessionActor } from '../../common/security/session.types';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
} from '../dtos/work-request.dto';
import { WorkRequestInfoRepository } from '../repositories/work-request-info.repository';
import { WorkRequestResourceScopeProvider } from './work-request-resource-scope.provider';

@Injectable()
export class WorkRequestInfoProvider {
  constructor(
    private readonly repository: WorkRequestInfoRepository,
    private readonly uow: UnitOfWorkService,
    private readonly scope: WorkRequestResourceScopeProvider,
    private readonly scopes: ObjectScopeProvider,
  ) {}

  request(
    id: string,
    input: CreateWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        this.assertPermission(actor, WorkflowActionCode.REQUEST_WORKFLOW_INFO);
        const snapshot = await this.repository.prepare(id, input.targetActorId);
        if (!snapshot?.parent || !snapshot.target) throw notFound();
        const teamId =
          snapshot.request.assignments.find((item) => item.level === 'TEAM')
            ?.teamId ?? null;
        const divisionId =
          snapshot.request.assignments.find((item) => item.level === 'DIVISION')
            ?.divisionId ?? null;
        this.scope.assert(actor, {
          clientId: snapshot.parent.clientId,
          companyId: snapshot.parent.client.companyId,
          divisionId,
          teamId,
        });
        this.assertCustomScope(
          actor,
          snapshot.parent.client.companyId,
          divisionId,
        );
        const target = snapshot.target;
        const hasGrant =
          target.user?.isActive &&
          target.user.userRolesByUserId.some(
            (grant) => grant.roleId === target.roleId,
          );
        const memberTarget =
          target.member?.isActive &&
          target.member.companyId === snapshot.parent.client.companyId;
        const contactTarget =
          target.clientContact?.isActive &&
          target.clientContact.client.isActive &&
          target.clientContact.clientId === snapshot.parent.clientId;
        if (!hasGrant || (!memberTarget && !contactTarget)) throw forbidden();
        if (
          actor.role.isSystemRole === false &&
          actor.role.customScope === 'division' &&
          (!divisionId || target.member?.divisionId !== divisionId)
        )
          throw forbidden();
        if (
          actor.role.isSystemRole === false &&
          actor.role.customScope === 'team'
        ) {
          if (
            !actor.boundTeamId ||
            !target.member?.teamMembersByMemberId.some(
              (row) => row.teamId === actor.boundTeamId && row.team.isActive,
            )
          )
            throw forbidden();
        }
        const state = snapshot.request.events[0]?.resultingState;
        if (!state)
          throw conflict('Work Request has no current workflow state.');
        return this.repository.create({
          workRequestId: id,
          requestedByActorId: actor.id,
          targetActorId: input.targetActorId,
          message: input.message,
          stateAtRequest: state,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async respond(
    id: string,
    infoRequestId: string,
    input: RespondWorkRequestInfoRequestDto,
    actor: SessionActor,
  ) {
    return this.uow.execute(
      async () => {
        this.assertPermission(actor, WorkflowActionCode.RESPOND_WORKFLOW_INFO);
        const snapshot = await this.repository.prepare(id);
        if (!snapshot?.parent) throw notFound();
        const teamId =
          snapshot.request.assignments.find((item) => item.level === 'TEAM')
            ?.teamId ?? null;
        const divisionId =
          snapshot.request.assignments.find((item) => item.level === 'DIVISION')
            ?.divisionId ?? null;
        this.scope.assert(actor, {
          clientId: snapshot.parent.clientId,
          companyId: snapshot.parent.client.companyId,
          divisionId,
          teamId,
        });
        this.assertCustomScope(
          actor,
          snapshot.parent.client.companyId,
          divisionId,
        );
        const result = await this.repository.respond(
          id,
          infoRequestId,
          actor.id,
          input.message,
        );
        if (result.kind === 'missing')
          throw notFound('Information Request was not found.');
        if (result.kind === 'forbidden') throw forbidden();
        if (result.kind === 'closed')
          throw conflict('Information Request is already closed.');
        return result.response;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async history(id: string, actor: SessionActor) {
    return this.uow.execute(async () => {
      const snapshot = await this.repository.prepare(id);
      if (!snapshot?.parent) throw notFound();
      const teamId =
        snapshot.request.assignments.find((item) => item.level === 'TEAM')
          ?.teamId ?? null;
      const divisionId =
        snapshot.request.assignments.find((item) => item.level === 'DIVISION')
          ?.divisionId ?? null;
      this.scope.assert(actor, {
        clientId: snapshot.parent.clientId,
        companyId: snapshot.parent.client.companyId,
        divisionId,
        teamId,
      });
      this.assertCustomScope(
        actor,
        snapshot.parent.client.companyId,
        divisionId,
      );
      return this.repository.history(id);
    });
  }

  private assertPermission(actor: SessionActor, action: WorkflowActionCode) {
    if (
      actor.role.userRolesByRoleId.length !== 1 ||
      !actor.role.workflowActionRolePermissionsByRoleId.some(
        ({ action: grant }) => grant.code === action,
      )
    )
      throw forbidden();
  }

  private assertCustomScope(
    actor: SessionActor,
    companyId: string | null,
    divisionId: string | null,
  ) {
    const scope = this.scopes.resolve(actor);
    if (
      scope.isSystemRole ||
      scope.customScope !== 'division' ||
      !companyId ||
      !divisionId
    ) {
      if (!scope.isSystemRole && scope.customScope === 'division')
        throw forbidden();
      return;
    }
    this.scopes.assertCanAccess(actor, {
      allOf: [
        { kind: 'memberCompany', companyId },
        { kind: 'memberDivision', divisionId },
      ],
      allowTenantAdmin: false,
    });
  }
}

function notFound(message = 'Work Request was not found.') {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
function forbidden() {
  return new AppException({
    code: AppErrorCode.Forbidden,
    status: HttpStatus.FORBIDDEN,
    message: "You don't have permission to perform this action.",
  });
}
function conflict(message: string) {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
